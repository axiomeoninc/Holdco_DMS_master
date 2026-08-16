import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { logSocialAudit } from "@/src/lib/social/audit";
import {
    buildFacebookOAuthUrl,
    buildOAuthState,
    getFacebookEnv,
    getFacebookRedirectUri,
} from "@/src/lib/social/facebook";

/**
 * Facebook Page connection status + OAuth start / disconnect.
 * Live Graph publish requires FACEBOOK_APP_ID + FACEBOOK_APP_SECRET.
 */

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const target =
            auth.profile.is_platform_admin && new URL(req.url).searchParams.get("dealership_id")
                ? new URL(req.url).searchParams.get("dealership_id")!
                : dealershipId;

        if (!target) {
            return NextResponse.json({ error: "dealership_id required" }, { status: 400 });
        }

        const env = getFacebookEnv();

        const { data, error } = await supabaseAdmin
            .from("facebook_business_account")
            .select("id, account_name, page_id, page_name, is_active, access_token, created_at, updated_at")
            .eq("dealership_id", target)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        const hasToken = Boolean(data?.access_token);
        const connected = Boolean(data?.is_active && hasToken);

        return NextResponse.json({
            data: data
                ? {
                      id: data.id,
                      account_name: data.account_name,
                      page_id: data.page_id,
                      page_name: data.page_name,
                      is_active: data.is_active,
                      created_at: data.created_at,
                      updated_at: data.updated_at,
                      connected,
                      has_token: hasToken,
                  }
                : { connected: false, has_token: false },
            oauth_ready: env.oauth_ready,
            missing_env: env.missing,
            message: env.oauth_ready
                ? connected
                    ? "Facebook Page connected."
                    : "Ready to connect a Facebook Page."
                : `Connect requires env: ${env.missing.join(", ") || "FACEBOOK_APP_ID, FACEBOOK_APP_SECRET"}. Draft posts still work.`,
        });
    } catch (error: unknown) {
        console.error("Error fetching Facebook status:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const action = body.action || "oauth_start";
        const env = getFacebookEnv();

        if (action === "disconnect") {
            await supabaseAdmin
                .from("facebook_business_account")
                .update({
                    is_active: false,
                    access_token: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("dealership_id", dealershipId)
                .eq("is_active", true);

            await logSocialAudit({
                action: "social.facebook.disconnect",
                entityType: "facebook_business_account",
                profile: auth.profile,
                dealershipId,
            });

            return NextResponse.json({
                data: { connected: false },
                message: "Facebook Page disconnected.",
            });
        }

        if (action === "oauth_start" || action === "connect") {
            if (!env.oauth_ready) {
                return NextResponse.json(
                    {
                        error: `Connect requires env: ${env.missing.join(", ")}`,
                        oauth_ready: false,
                        missing_env: env.missing,
                    },
                    { status: 503 }
                );
            }

            const redirectUri = getFacebookRedirectUri(req.url);
            const state = await buildOAuthState({
                dealershipId,
                userId: auth.profile.id,
            });
            const oauthUrl = buildFacebookOAuthUrl({ redirectUri, state });

            await logSocialAudit({
                action: "social.facebook.oauth_start",
                entityType: "facebook_business_account",
                profile: auth.profile,
                dealershipId,
                metadata: { redirect_uri: redirectUri },
            });

            return NextResponse.json({
                data: { oauth_url: oauthUrl },
                oauth_ready: true,
                message: "Redirect user to oauth_url to connect a Facebook Page.",
            });
        }

        return NextResponse.json(
            { error: "Unknown action. Use oauth_start or disconnect." },
            { status: 400 }
        );
    } catch (error: unknown) {
        console.error("Error in Facebook connect:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
