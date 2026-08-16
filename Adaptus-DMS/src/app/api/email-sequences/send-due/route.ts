/**
 * Process due CRM email sequence enrollments (Resend).
 *
 * Auth: Authorization: Bearer <CRM_CRON_SECRET|SOCIAL_CRON_SECRET>
 *   or x-crm-cron-secret / x-social-cron-secret header.
 *
 * Degrades cleanly when Resend secrets missing — no fake "sent" rows.
 * Cloudflare hourly cron → worker scheduled → this route.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { isResendConfigured } from "@/src/lib/resend";
import {
    resolveRecipientForEnrollment,
    sendNextSequenceStep,
} from "@/src/lib/crm/email-sequences";

function cronSecret(): string | null {
    const a = process.env.CRM_CRON_SECRET?.trim();
    const b = process.env.SOCIAL_CRON_SECRET?.trim();
    return a || b || null;
}

function authorizeCron(req: NextRequest): boolean {
    const secret = cronSecret();
    if (!secret) return false;
    const headers = [
        req.headers.get("x-crm-cron-secret"),
        req.headers.get("x-social-cron-secret"),
    ];
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    return headers.includes(secret) || bearer === secret;
}

export async function POST(req: NextRequest) {
    try {
        if (!cronSecret()) {
            return NextResponse.json(
                {
                    error: "CRM_CRON_SECRET (or SOCIAL_CRON_SECRET) not configured",
                    message:
                        "Due enrollments stay queued. Set a cron secret and Resend keys, " +
                        "or use Send next on a lead enrollment manually.",
                    code: "CRON_NOT_CONFIGURED",
                },
                { status: 503 }
            );
        }

        if (!authorizeCron(req)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isResendConfigured()) {
            return NextResponse.json(
                {
                    error: "Resend is not configured",
                    code: "NOT_CONFIGURED",
                    missingConfig: true,
                    message:
                        "Set RESEND_API_KEY and EMAIL_FROM. Due enrollments were not marked sent.",
                    processed: 0,
                },
                { status: 503 }
            );
        }

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
            .from("email_sequence_enrollments")
            .select("*")
            .eq("status", "active")
            .lte("next_send_at", nowIso)
            .order("next_send_at", { ascending: true })
            .limit(40);

        if (error) throw error;

        const results: Array<{
            id: string;
            ok: boolean;
            status?: string;
            error?: string;
            code?: string;
        }> = [];

        for (const enrollment of due || []) {
            if (!enrollment.dealership_id) {
                results.push({
                    id: enrollment.id,
                    ok: false,
                    error: "missing dealership",
                });
                continue;
            }

            const recipient = await resolveRecipientForEnrollment(
                supabaseAdmin,
                enrollment
            );
            if ("error" in recipient) {
                results.push({
                    id: enrollment.id,
                    ok: false,
                    error: recipient.error,
                });
                continue;
            }

            const result = await sendNextSequenceStep(supabaseAdmin, {
                enrollmentId: enrollment.id,
                dealershipId: enrollment.dealership_id,
                recipient,
                force: false,
            });

            if (!result.ok) {
                results.push({
                    id: enrollment.id,
                    ok: false,
                    error: result.error,
                    code: result.code,
                });
                continue;
            }

            results.push({
                id: enrollment.id,
                ok: true,
                status: result.status,
            });
        }

        const sent = results.filter((r) => r.ok && r.status === "sent").length;
        const skipped = results.filter((r) => r.ok && r.status !== "sent").length;
        const failed = results.filter((r) => !r.ok).length;

        return NextResponse.json({
            due_count: due?.length || 0,
            sent,
            skipped,
            failed,
            results,
            meta: {
                resend_configured: true,
                message: "Processed due CRM sequence enrollments.",
            },
        });
    } catch (error: unknown) {
        console.error("email-sequences send-due:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}

/** Allow GET for simple cron pingers with the same auth. */
export async function GET(req: NextRequest) {
    return POST(req);
}
