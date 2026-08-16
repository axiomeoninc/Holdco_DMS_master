import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { logSocialAudit } from "@/src/lib/social/audit";
import {
    exchangeCodeForUserToken,
    getFacebookEnv,
    getFacebookRedirectUri,
    listManagedPages,
    parseOAuthState,
} from "@/src/lib/social/facebook";

/**
 * Meta OAuth callback — exchanges code for Page access token and stores
 * dealership-scoped facebook_business_account (token never exposed to UI).
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const origin = url.origin;
    const socialPath = `${origin}/social`;

    const failRedirect = (msg: string) =>
        NextResponse.redirect(`${socialPath}?fb=error&message=${encodeURIComponent(msg)}`);

    if (errorParam) {
        return failRedirect(errorDescription || errorParam);
    }

    const env = getFacebookEnv();
    if (!env.oauth_ready) {
        return failRedirect(`Connect requires env: ${env.missing.join(", ")}`);
    }

    if (!code || !state) {
        return failRedirect("Missing OAuth code or state.");
    }

    const parsed = await parseOAuthState(state);
    if (!parsed) {
        return failRedirect("Invalid or expired OAuth state.");
    }

    try {
        const redirectUri = getFacebookRedirectUri(req.url);
        const userToken = await exchangeCodeForUserToken({ code, redirectUri });
        const pages = await listManagedPages(userToken);

        if (pages.length === 0) {
            return failRedirect("No Facebook Pages found for this account.");
        }

        const preferredPageId = url.searchParams.get("page_id");
        const page =
            (preferredPageId && pages.find((p) => p.id === preferredPageId)) || pages[0]!;

        const { data: existing } = await supabaseAdmin
            .from("facebook_business_account")
            .select("id")
            .eq("dealership_id", parsed.dealershipId)
            .maybeSingle();

        const row = {
            account_name: page.name,
            page_id: page.id,
            page_name: page.name,
            access_token: page.access_token,
            is_active: true,
            dealership_id: parsed.dealershipId,
            updated_at: new Date().toISOString(),
        };

        if (existing?.id) {
            const { error } = await supabaseAdmin
                .from("facebook_business_account")
                .update(row)
                .eq("id", existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin.from("facebook_business_account").insert(row);
            if (error) throw error;
        }

        // Soft audit — actor may not match cookie on callback; use state user id
        try {
            const { data: profile } = await supabaseAdmin
                .from("users")
                .select("id, email, role, dealership_id, is_platform_admin, full_name, phone, avatar, is_active")
                .eq("id", parsed.userId)
                .maybeSingle();
            if (profile) {
                await logSocialAudit({
                    action: "social.facebook.connect",
                    entityType: "facebook_business_account",
                    profile: {
                        ...profile,
                        user_permissions: [],
                    },
                    dealershipId: parsed.dealershipId,
                    metadata: { page_id: page.id, page_name: page.name },
                });
            }
        } catch (auditErr) {
            console.warn("[social] connect audit skipped:", auditErr);
        }

        return NextResponse.redirect(
            `${socialPath}?fb=connected&page=${encodeURIComponent(page.name)}`
        );
    } catch (error: unknown) {
        console.error("Facebook OAuth callback failed:", error);
        return failRedirect(
            error instanceof Error ? error.message : "Facebook OAuth failed"
        );
    }
}
