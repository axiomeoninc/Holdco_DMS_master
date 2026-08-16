import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { isResendConfigured } from "@/src/lib/resend";
import {
    resolveRecipientForEnrollment,
    sendNextSequenceStep,
} from "@/src/lib/crm/email-sequences";

function canManage(profile: {
    is_platform_admin?: boolean;
    role?: string;
    user_permissions?: string[];
}): boolean {
    if (profile.is_platform_admin) return true;
    if (profile.role === "Admin" || profile.role === "Manager") return true;
    const perms = profile.user_permissions || [];
    return (
        perms.includes("*") ||
        perms.includes("leads:write") ||
        perms.includes("follow_ups:write")
    );
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        if (!canManage(auth.profile)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const writeScope = tenantScopeFromRequest(tenant, req);
        const dealershipId = requireWriteDealershipId(writeScope);

        const { id } = await params;

        if (!isResendConfigured()) {
            return NextResponse.json(
                {
                    error:
                        "Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM (Settings → Integrations).",
                    code: "NOT_CONFIGURED",
                    missingConfig: true,
                },
                { status: 503 }
            );
        }

        const { data: enrollment, error: enrErr } = await scopedTable(
            supabase,
            "email_sequence_enrollments",
            writeScope
        )
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (enrErr || !enrollment) {
            return NextResponse.json(
                { error: "Enrollment not found" },
                { status: 404 }
            );
        }

        const recipient = await resolveRecipientForEnrollment(
            supabase,
            enrollment
        );
        if ("error" in recipient) {
            return NextResponse.json(
                { error: recipient.error },
                { status: 400 }
            );
        }

        const result = await sendNextSequenceStep(supabase, {
            enrollmentId: id,
            dealershipId,
            recipient,
            force: true,
        });

        if (!result.ok) {
            const status =
                result.code === "NOT_CONFIGURED"
                    ? 503
                    : result.code === "STOPPED"
                      ? 409
                      : 400; // NO_EMAIL, NO_CONSENT, SEND_FAILED, …
            return NextResponse.json(result, { status });
        }

        const { data: refreshed } = await scopedTable(
            supabase,
            "email_sequence_enrollments",
            writeScope
        )
            .select(
                `*,
                sequence:email_sequences(id, name, is_active),
                sends:email_sequence_sends(id, step_order, status, to_email, error, resend_id, sent_at)`
            )
            .eq("id", id)
            .maybeSingle();

        return NextResponse.json({
            data: refreshed,
            send: result,
            meta: { resend_configured: true },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("send-next POST:", error);
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
