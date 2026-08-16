import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import {
    resolveRecipientForSmsEnrollment,
    sendNextSmsSequenceStep,
} from "@/src/lib/crm/sms-sequences";

type Params = { params: Promise<{ id: string }> };

/**
 * Manual "Send next" for an SMS sequence enrollment.
 * Returns honest status: sent / skipped / blocked / not configured.
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const writeScope = tenantScopeFromRequest(tenant, req);
        const rooftop = requireWriteDealershipId(writeScope);
        const { id } = await params;

        const { data: enrollment, error: enrErr } = await scopedTable(
            supabase,
            "sms_sequence_enrollments",
            writeScope
        )
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (enrErr) throw enrErr;
        if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const recipient = await resolveRecipientForSmsEnrollment(supabase, enrollment);
        if ("error" in recipient) {
            return NextResponse.json(
                { error: recipient.error, code: "NO_RECIPIENT" },
                { status: 400 }
            );
        }

        const result = await sendNextSmsSequenceStep(supabase, {
            enrollmentId: enrollment.id,
            dealershipId: rooftop,
            recipient,
            force: true,
        });

        if (result.ok) {
            return NextResponse.json({ data: result });
        }

        const status =
            result.code === "NOT_CONFIGURED"
                ? 501
                : result.code === "QUIET_HOURS"
                  ? 409
                  : result.code === "NO_CONSENT"
                    ? 403
                    : 400;
        return NextResponse.json(
            { error: result.error, code: result.code, missingConfig: result.missingConfig },
            { status }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS send-next error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
