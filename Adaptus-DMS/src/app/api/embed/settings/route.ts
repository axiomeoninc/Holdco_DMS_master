// Dealership-scoped website inventory embed settings (token + snippet).
import {
    buildIframeSnippet,
    buildScriptSnippet,
} from "@/src/lib/public-inventory";
import { getCurrentUser } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

function newEmbedToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `aix_${hex}`;
}

function responsePayload(opts: {
    origin: string;
    dealershipId: string;
    dealershipName: string;
    slug: string | null;
    token: string;
    vdpBase: string | null;
    tokenRequired: boolean;
    message?: string;
}) {
    const snippet = buildScriptSnippet({
        origin: opts.origin,
        dealershipId: opts.dealershipId,
        token: opts.token,
        vdpBase: opts.vdpBase,
    });
    const iframe_snippet = buildIframeSnippet({
        origin: opts.origin,
        token: opts.token,
        dealershipId: opts.dealershipId,
    });
    const showroom_url = opts.slug
        ? `${opts.origin}/showroom/${encodeURIComponent(opts.slug)}`
        : null;
    return {
        dealership_id: opts.dealershipId,
        dealership_name: opts.dealershipName,
        slug: opts.slug,
        embed_token: opts.token,
        embed_vdp_base: opts.vdpBase,
        embed_token_required: opts.tokenRequired,
        snippet,
        iframe_snippet,
        showroom_url,
        api_url: `${opts.origin}/api/vehicles/public?dealership_id=${opts.dealershipId}&token=${opts.token}`,
        wordpress_note:
            "WordPress / Wix / Squarespace: paste the HTML snippet or iframe into a Custom HTML block. Allow script or iframe from your FlashFender origin. Native pages fed by the JSON API remain best for SEO.",
        message: opts.message,
    };
}

async function getCaller(req: NextRequest) {
    const { user, profile, error } = await getCurrentUser(req);
    if (error || !user || !profile) {
        return { error: error || "Unauthorized", status: 401 as const };
    }
    return { supabase: supabaseAdmin, user, profile, error: null as null, status: 200 as const };
}

/** GET current embed settings for the caller's dealership (or ?dealership_id= for platform admin). */
export async function GET(req: NextRequest) {
    try {
        const caller = await getCaller(req);
        if (caller.error || !caller.profile) {
            return NextResponse.json({ error: caller.error }, { status: caller.status });
        }

        const url = new URL(req.url);
        const requestedId = url.searchParams.get("dealership_id");
        const isPlatformAdmin = caller.profile.is_platform_admin === true;
        const isDealershipAdmin = caller.profile.role === "Admin";
        const isDealershipManager = caller.profile.role === "Manager";

        if (!isPlatformAdmin && !isDealershipAdmin && !isDealershipManager) {
            return NextResponse.json(
                { error: "Unauthorized - Admin or Manager access required" },
                { status: 403 }
            );
        }

        let dealershipId = caller.profile.dealership_id as string | null;
        if (isPlatformAdmin && requestedId) {
            dealershipId = requestedId;
        }

        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }

        // Non-platform admins cannot spoof another dealership
        if (!isPlatformAdmin && dealershipId !== caller.profile.dealership_id) {
            return NextResponse.json(
                { error: "Forbidden - Dealership access denied" },
                { status: 403 }
            );
        }

        const { data: dealership, error } = await supabaseAdmin
            .from("dealerships")
            .select("id, name, slug, settings, business_name")
            .eq("id", dealershipId)
            .single();

        if (error || !dealership) {
            return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
        }

        const settings = (dealership.settings || {}) as Record<string, unknown>;
        let token = typeof settings.embed_token === "string" ? settings.embed_token : null;
        const vdpBase =
            typeof settings.embed_vdp_base === "string" ? settings.embed_vdp_base : null;

        // Lazy-provision token on first view (no vehicle/deal rows touched)
        if (!token) {
            token = newEmbedToken();
            const nextSettings = { ...settings, embed_token: token };
            await supabaseAdmin
                .from("dealerships")
                .update({ settings: nextSettings })
                .eq("id", dealershipId);
        }

        const origin = url.origin;
        return NextResponse.json({
            data: responsePayload({
                origin,
                dealershipId: dealership.id,
                dealershipName: dealership.business_name || dealership.name,
                slug: dealership.slug,
                token,
                vdpBase,
                tokenRequired: settings.embed_token_required === true,
            }),
        });
    } catch (error: unknown) {
        console.error("Error fetching embed settings:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** POST rotate token or update VDP base. Body: { action?: "rotate", embed_vdp_base?: string, dealership_id?: string } */
export async function POST(req: NextRequest) {
    try {
        const caller = await getCaller(req);
        if (caller.error || !caller.profile) {
            return NextResponse.json({ error: caller.error }, { status: caller.status });
        }

        const isPlatformAdmin = caller.profile.is_platform_admin === true;
        const isDealershipAdmin = caller.profile.role === "Admin";
        const isDealershipManager = caller.profile.role === "Manager";

        if (!isPlatformAdmin && !isDealershipAdmin && !isDealershipManager) {
            return NextResponse.json(
                { error: "Unauthorized - Admin or Manager access required" },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const action = body.action as string | undefined;

        let dealershipId = caller.profile.dealership_id as string | null;
        if (isPlatformAdmin && typeof body.dealership_id === "string") {
            dealershipId = body.dealership_id;
        }

        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 400 });
        }

        if (!isPlatformAdmin && dealershipId !== caller.profile.dealership_id) {
            return NextResponse.json(
                { error: "Forbidden - Dealership access denied" },
                { status: 403 }
            );
        }

        const { data: dealership, error } = await supabaseAdmin
            .from("dealerships")
            .select("id, name, slug, settings, business_name")
            .eq("id", dealershipId)
            .single();

        if (error || !dealership) {
            return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
        }

        const settings = { ...((dealership.settings || {}) as Record<string, unknown>) };

        if (action === "rotate" || !settings.embed_token) {
            settings.embed_token = newEmbedToken();
        }

        if (typeof body.embed_vdp_base === "string") {
            settings.embed_vdp_base = body.embed_vdp_base.trim() || null;
        }

        if (typeof body.embed_token_required === "boolean") {
            settings.embed_token_required = body.embed_token_required;
        }

        const { error: updateError } = await supabaseAdmin
            .from("dealerships")
            .update({ settings })
            .eq("id", dealershipId);

        if (updateError) throw updateError;

        const origin = new URL(req.url).origin;
        const token = settings.embed_token as string;
        const vdpBase =
            typeof settings.embed_vdp_base === "string" ? settings.embed_vdp_base : null;

        return NextResponse.json({
            data: responsePayload({
                origin,
                dealershipId: dealership.id,
                dealershipName: dealership.business_name || dealership.name,
                slug: dealership.slug,
                token,
                vdpBase,
                tokenRequired: settings.embed_token_required === true,
                message:
                    action === "rotate"
                        ? "Embed token rotated. Update any pasted snippets on your website."
                        : "Embed settings saved.",
            }),
        });
    } catch (error: unknown) {
        console.error("Error updating embed settings:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
