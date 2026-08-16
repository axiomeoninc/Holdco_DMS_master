import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

type Params = { params: Promise<{ id: string }> };

/**
 * Enroll a customer (or lead) into an SMS sequence.
 * Body: { customer_id?, lead_id?, force? } — exactly one of customer_id/lead_id.
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const writeScope = tenantScopeFromRequest(tenant, req);
        const rooftop = requireWriteDealershipId(writeScope);
        const { id } = await params;
        const body = await req.json().catch(() => ({}));

        const customerId = typeof body.customer_id === "string" ? body.customer_id : null;
        const leadId = typeof body.lead_id === "string" ? body.lead_id : null;
        if (!customerId && !leadId) {
            return NextResponse.json(
                { error: "Provide customer_id or lead_id" },
                { status: 400 }
            );
        }

        const { data: sequence, error: seqErr } = await scopedTable(
            supabase,
            "sms_sequences",
            writeScope
        )
            .select("id, name, is_active, dealership_id")
            .eq("id", id)
            .maybeSingle();
        if (seqErr) throw seqErr;
        if (!sequence) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!sequence.is_active) {
            return NextResponse.json(
                { error: "SMS sequence is inactive" },
                { status: 400 }
            );
        }

        let targetCustomerId: string | null = customerId;
        if (leadId) {
            const { data: lead } = await scopedTable(supabase, "leads", writeScope)
                .select("id, customer_id, dealership_id")
                .eq("id", leadId)
                .maybeSingle();
            if (!lead) {
                return NextResponse.json({ error: "Lead not found" }, { status: 404 });
            }
            targetCustomerId = lead.customer_id || null;
        }

        if (targetCustomerId) {
            const { data: customer } = await scopedTable(
                supabase,
                "customers",
                writeScope
            )
                .select("id, sms_consent, phone, dealership_id")
                .eq("id", targetCustomerId)
                .maybeSingle();
            if (!customer) {
                return NextResponse.json({ error: "Customer not found" }, { status: 404 });
            }
            if (!customer.sms_consent || !customer.phone?.trim()) {
                return NextResponse.json(
                    {
                        error:
                            "Customer has not consented to SMS (or has no phone). Enable SMS consent first.",
                        code: "SMS_CONSENT_REQUIRED",
                    },
                    { status: 403 }
                );
            }
        }

        const enrollment = {
            dealership_id: rooftop,
            sequence_id: id,
            lead_id: leadId,
            customer_id: targetCustomerId,
            status: "active" as const,
            current_step: 0,
            enrolled_by: auth.profile.id,
            next_send_at: new Date().toISOString(),
        };

        const { data: created, error: enrErr } = await supabase
            .from("sms_sequence_enrollments")
            .insert(enrollment)
            .select("id, status, next_send_at")
            .single();

        if (enrErr) {
            if (enrErr.code === "23505") {
                return NextResponse.json(
                    { error: "Already enrolled in this SMS sequence", code: "DUPLICATE_ENROLLMENT" },
                    { status: 409 }
                );
            }
            throw enrErr;
        }

        return NextResponse.json(
            { data: created, message: "Enrolled. First message will send when due." },
            { status: 201 }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS sequence enroll error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
