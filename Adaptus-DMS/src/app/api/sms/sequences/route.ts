import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    EMPTY_TENANT_ID,
    requireWriteDealershipId,
    resolveTenantDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { ensureDefaultSmsSequence } from "@/src/lib/crm/sms-sequences";

/**
 * SMS sequences — list (with steps) or create. On first read, ensures the
 * dealership has the default 2-step SMS follow-up.
 */
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const rooftop = resolveTenantDealershipId(scope, "sms_sequences");

        if (rooftop && rooftop !== EMPTY_TENANT_ID) {
            const ensured = await ensureDefaultSmsSequence(supabase, {
                dealershipId: rooftop,
                userId: auth.profile.id,
            });
            if (!ensured.ok) {
                return NextResponse.json(
                    { error: ensured.error || "Failed to ensure default sequence" },
                    { status: 500 }
                );
            }
        }

        const { data: sequences, error } = await applyTenantScope(
            supabase
                .from("sms_sequences")
                .select(
                    "*, steps:sms_sequence_steps(id, sequence_id, step_order, delay_days, body_text, created_at, updated_at)"
                )
                .order("created_at", { ascending: true }),
            scope,
            "sms_sequences"
        );

        if (error) throw error;

        return NextResponse.json({ data: sequences || [] });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS sequences list error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

type StepInput = { step_order: number; delay_days?: number; body_text: string };

export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const writeScope = tenantScopeFromRequest(tenant, req);

        const isAdmin =
            auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const rooftop = requireWriteDealershipId(writeScope);

        const body = await req.json().catch(() => ({}));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
            return NextResponse.json({ error: "name is required" }, { status: 400 });
        }
        const description =
            typeof body.description === "string" ? body.description : null;
        const steps: StepInput[] = Array.isArray(body.steps) ? body.steps : [];

        if (steps.length === 0 || steps.length > 10) {
            return NextResponse.json(
                { error: "Provide between 1 and 10 steps" },
                { status: 400 }
            );
        }
        for (const s of steps) {
            if (
                typeof s.body_text !== "string" ||
                !s.body_text.trim() ||
                typeof s.step_order !== "number"
            ) {
                return NextResponse.json(
                    { error: "Each step needs step_order and body_text" },
                    { status: 400 }
                );
            }
        }
        if (new Set(steps.map((s) => s.step_order)).size !== steps.length) {
            return NextResponse.json(
                { error: "step_order values must be unique" },
                { status: 400 }
            );
        }

        const { data: sequence, error: seqErr } = await supabase
            .from("sms_sequences")
            .insert({
                dealership_id: rooftop,
                name,
                description,
                is_active: body.is_active !== false,
                created_by: auth.profile.id,
            })
            .select("id")
            .single();

        if (seqErr) throw seqErr;

        const stepRows = steps.map((s) => ({
            sequence_id: sequence.id,
            step_order: s.step_order,
            delay_days: typeof s.delay_days === "number" ? Math.max(0, Math.floor(s.delay_days)) : 0,
            body_text: s.body_text.trim(),
        }));

        const { error: stepsErr } = await supabase
            .from("sms_sequence_steps")
            .insert(stepRows);

        if (stepsErr) throw stepsErr;

        return NextResponse.json(
            { data: { id: sequence.id }, message: "SMS sequence created." },
            { status: 201 }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS sequence create error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
