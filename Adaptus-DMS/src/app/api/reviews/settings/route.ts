// Review automation settings (dealership-scoped; stored in dealerships.settings).
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    readReviewConfig,
    DEFAULT_REVIEW_CONFIG,
    reviewConfigConfigured,
} from "@/src/lib/reviews";
import { isResendConfigured } from "@/src/lib/resend";

function canManageSettings(profile: {
    role?: string | null;
    is_platform_admin?: boolean | null;
    user_permissions?: string[] | null;
}): boolean {
    if (profile.is_platform_admin) return true;
    if (profile.role === "Admin" || profile.role === "Manager") return true;
    const perms = profile.user_permissions || [];
    if (perms.includes("*")) return true;
    return perms.includes("settings:write") || perms.includes("settings:company");
}

async function loadDealershipSettings(dealershipId: string) {
    const { data, error } = await supabaseAdmin
        .from("dealerships")
        .select("id, name, business_name, settings")
        .eq("id", dealershipId)
        .maybeSingle();
    if (error) throw error;
    return data as {
        id: string;
        name: string;
        business_name: string | null;
        settings: Record<string, unknown> | null;
    } | null;
}

function shape(dealership: NonNullable<Awaited<ReturnType<typeof loadDealershipSettings>>>) {
    const config = readReviewConfig(dealership.settings || {});
    return {
        config,
        configured: reviewConfigConfigured(config),
        resend_configured: isResendConfigured(),
        dealership_name: dealership.business_name || dealership.name,
        can_edit: true,
        note: config.enabled
            ? config.auto_send
                ? "Auto-send is on. Review emails are sent only when Resend is configured and the customer has marketing consent."
                : "Review automation is enabled but auto-send is off — requests stay as drafts for your approval."
            : "Review automation is off. Turn it on to queue review-request drafts after deals close.",
    };
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.is_platform_admin
            ? (new URL(req.url).searchParams.get("dealership_id") || auth.profile.dealership_id)
            : auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const dealership = await loadDealershipSettings(dealershipId);
        if (!dealership) {
            return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
        }

        return NextResponse.json({ data: shape(dealership) });
    } catch (error: unknown) {
        console.error("Error fetching review settings:", error);
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
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        if (!canManageSettings(auth.profile)) {
            return NextResponse.json(
                { error: "Forbidden — Admin/Manager or settings:write required" },
                { status: 403 }
            );
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const dealership = await loadDealershipSettings(dealershipId);
        if (!dealership) {
            return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
        }

        const body = await req.json().catch(() => ({}));
        const settings = { ...(dealership.settings || {}) } as Record<string, unknown>;
        const current = readReviewConfig(settings);
        const next = { ...current };

        if (typeof body.enabled === "boolean") next.enabled = body.enabled;
        if (typeof body.auto_send === "boolean") next.auto_send = body.auto_send;
        if (typeof body.days_after_deal === "number" && body.days_after_deal > 0) {
            next.days_after_deal = Math.min(Math.round(body.days_after_deal), 90);
        }
        if (typeof body.google_review_url === "string") {
            next.google_review_url = body.google_review_url.trim() || null;
        }
        if (typeof body.review_note === "string") {
            next.review_note = body.review_note.trim() || null;
        }

        settings.review_automation = next;

        const { error } = await supabaseAdmin
            .from("dealerships")
            .update({ settings })
            .eq("id", dealershipId);
        if (error) throw error;

        const updated = await loadDealershipSettings(dealershipId);
        if (!updated) {
            return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
        }

        return NextResponse.json({
            data: {
                ...shape(updated),
                message: next.enabled
                    ? next.auto_send
                        ? "Review automation enabled with auto-send."
                        : "Review automation enabled (drafts only)."
                    : "Review automation disabled.",
            },
        });
    } catch (error: unknown) {
        console.error("Error updating review settings:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
