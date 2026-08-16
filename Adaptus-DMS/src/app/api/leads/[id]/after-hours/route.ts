// After-hours 24/7 AI first response for a lead.
// GET  → status (channel configured, quiet hours, existing replies)
// POST → { action: "draft" | "draft_and_send" }
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { isResendConfigured } from "@/src/lib/resend";
import { FlashAiNotConfiguredError } from "@/src/lib/ai/llm";
import {
    isQuietHour,
    aiNotConfiguredResponse,
} from "@/src/lib/ai/guard";
import {
    loadAfterHoursContext,
    runAfterHoursFirstResponse,
} from "@/src/lib/business/after-hours";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }
        const { id } = await params;

        const { data: replies, error } = await supabaseAdmin
            .from("ai_desk_replies")
            .select("id, channel, status, subject, body, bot_disclosure, consent_ok, escalated_to_human, escalate_reason, block_reason, error, sent_at, created_at")
            .eq("lead_id", id)
            .eq("dealership_id", dealershipId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) throw error;

        const ctx = await loadAfterHoursContext(dealershipId, id);
        const inQuietHours = "error" in ctx ? false : isQuietHour(new Date(), ctx.config);

        return NextResponse.json({
            data: replies || [],
            meta: {
                lead_exists: !("error" in ctx),
                resend_configured: isResendConfigured(),
                in_quiet_hours: inQuietHours,
                auto_send_enabled:
                    !("error" in ctx) && ctx.config.auto_send_enabled === true,
            },
        });
    } catch (err) {
        console.error("[leads/after-hours] GET", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to load status" },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }
        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as { action?: string };
        const action = body.action === "draft_and_send" ? "draft_and_send" : "draft";

        const result = await runAfterHoursFirstResponse({
            dealershipId,
            leadId: id,
            userId: auth.profile.id,
            action,
        });

        if (result.decision === "blocked") {
            return NextResponse.json(
                {
                    error: result.detail,
                    code: `after_hours_${result.reason}`,
                    data: result,
                },
                result.reason === "not_configured" ? { status: 503 } : { status: 422 }
            );
        }

        if (result.decision === "escalate") {
            return NextResponse.json({
                data: result,
                escalated: true,
                message: `Escalated to a human: ${result.reason}`,
            });
        }

        return NextResponse.json({
            data: result,
            message:
                result.decision === "sent"
                    ? "AI first response sent with bot disclosure"
                    : "Draft ready — review before send",
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[leads/after-hours] POST", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "After-hours reply failed" },
            { status: 500 }
        );
    }
}
