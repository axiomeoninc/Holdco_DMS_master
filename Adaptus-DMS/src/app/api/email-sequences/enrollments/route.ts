// List / create sequence enrollments (lead or customer).
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { isResendConfigured } from "@/src/lib/resend";
import {
    ensureDefaultLeadNurtureSequence,
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

export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const leadId = url.searchParams.get("lead_id");
        const customerId = url.searchParams.get("customer_id");
        const status = url.searchParams.get("status");

        let query = applyTenantScope(
            supabase
                .from("email_sequence_enrollments")
                .select(
                    `*,
                sequence:email_sequences(id, name, is_active),
                sends:email_sequence_sends(id, step_order, status, to_email, error, resend_id, sent_at)`
                )
                .order("enrolled_at", { ascending: false }),
            scope,
            "email_sequence_enrollments"
        );

        if (leadId) query = query.eq("lead_id", leadId);
        if (customerId) query = query.eq("customer_id", customerId);
        if (status) query = query.eq("status", status);

        const { data, error } = await query.limit(100);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            data: data || [],
            meta: { resend_configured: isResendConfigured() },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("enrollments GET:", error);
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

export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;

        if (!canManage(auth.profile)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const writeScope = tenantScopeFromRequest(tenant, req);
        const dealershipId = requireWriteDealershipId(writeScope);

        const body = (await req.json()) as {
            sequence_id?: string;
            lead_id?: string;
            customer_id?: string;
            send_first?: boolean;
            ensure_default?: boolean;
        };

        let sequenceId = body.sequence_id;

        if (!sequenceId || body.ensure_default) {
            const ensured = await ensureDefaultLeadNurtureSequence(supabase, {
                dealershipId,
                userId: auth.user.id,
            });
            if (!ensured.ok) {
                return NextResponse.json(
                    { error: ensured.error },
                    { status: 500 }
                );
            }
            sequenceId = sequenceId || ensured.sequenceId;
        }

        if (!sequenceId) {
            return NextResponse.json(
                { error: "sequence_id is required" },
                { status: 400 }
            );
        }

        if (!body.lead_id && !body.customer_id) {
            return NextResponse.json(
                { error: "lead_id or customer_id is required" },
                { status: 400 }
            );
        }

        const { data: sequence, error: seqErr } = await scopedTable(
            supabase,
            "email_sequences",
            writeScope
        )
            .select("id, is_active, dealership_id")
            .eq("id", sequenceId)
            .maybeSingle();

        if (seqErr || !sequence) {
            return NextResponse.json(
                { error: "Sequence not found" },
                { status: 404 }
            );
        }
        if (!sequence.is_active) {
            return NextResponse.json(
                { error: "Sequence is inactive" },
                { status: 400 }
            );
        }

        let customerId = body.customer_id || null;
        if (body.lead_id) {
            const { data: lead, error: leadErr } = await scopedTable(
                supabase,
                "leads",
                writeScope
            )
                .select("id, customer_id, dealership_id")
                .eq("id", body.lead_id)
                .maybeSingle();
            if (leadErr || !lead) {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            customerId = lead.customer_id || customerId;
        }

        if (customerId) {
            const { data: customer } = await scopedTable(
                supabase,
                "customers",
                writeScope
            )
                .select("id, email, marketing_consent, dealership_id")
                .eq("id", customerId)
                .maybeSingle();
            if (!customer) {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            if (!customer.email?.trim()) {
                return NextResponse.json(
                    {
                        error:
                            "Customer has no email — cannot enroll in email sequence",
                    },
                    { status: 400 }
                );
            }
        }

        const { data: enrollment, error: enrErr } = await supabase
            .from("email_sequence_enrollments")
            .insert({
                dealership_id: dealershipId,
                sequence_id: sequenceId,
                lead_id: body.lead_id || null,
                customer_id: customerId,
                status: "active",
                current_step: 0,
                enrolled_by: auth.user.id,
                next_send_at: new Date().toISOString(),
            })
            .select(
                `*,
                sequence:email_sequences(id, name, is_active)`
            )
            .single();

        if (enrErr) {
            if (enrErr.code === "23505") {
                return NextResponse.json(
                    {
                        error:
                            "Already enrolled in this sequence (active). Stop first to re-enroll.",
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: enrErr.message },
                { status: 500 }
            );
        }

        let firstSend: unknown = null;
        const wantFirst = body.send_first !== false;
        const resendOk = isResendConfigured();

        if (wantFirst) {
            if (!resendOk) {
                firstSend = {
                    ok: false,
                    missingConfig: true,
                    code: "NOT_CONFIGURED",
                    error:
                        "Enrolled, but first email not sent — Resend secrets missing. See Settings → Integrations.",
                };
            } else {
                const recipient = await resolveRecipientForEnrollment(
                    supabase,
                    enrollment
                );
                if ("error" in recipient) {
                    firstSend = { ok: false, error: recipient.error };
                } else {
                    firstSend = await sendNextSequenceStep(supabase, {
                        enrollmentId: enrollment.id,
                        dealershipId,
                        recipient,
                        force: true,
                    });
                }
            }
        }

        const { data: refreshed } = await supabase
            .from("email_sequence_enrollments")
            .select(
                `*,
                sequence:email_sequences(id, name, is_active),
                sends:email_sequence_sends(id, step_order, status, to_email, error, resend_id, sent_at)`
            )
            .eq("id", enrollment.id)
            .single();

        return NextResponse.json(
            {
                data: refreshed || enrollment,
                first_send: firstSend,
                meta: { resend_configured: resendOk },
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("enrollments POST:", error);
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
