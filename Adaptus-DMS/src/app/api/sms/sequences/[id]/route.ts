import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;

        const { data: sequence, error } = await scopedTable(
            supabase,
            "sms_sequences",
            scope
        )
            .select(
                "*, steps:sms_sequence_steps(id, sequence_id, step_order, delay_days, body_text, created_at, updated_at)"
            )
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        if (!sequence) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ data: sequence });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS sequence get error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const isAdmin =
            isPlatformAdmin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await req.json().catch(() => ({}));

        const { data: existing, error: findErr } = await scopedTable(
            supabase,
            "sms_sequences",
            scope
        )
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const patch: Record<string, unknown> = {};
        if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
        if (typeof body.description === "string") patch.description = body.description || null;
        if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

        const { error: updateErr } = await applyTenantScope(
            supabase.from("sms_sequences").update(patch).eq("id", id),
            scope,
            "sms_sequences"
        );
        if (updateErr) throw updateErr;

        if (Array.isArray(body.steps) && body.steps.length > 0) {
            await supabase.from("sms_sequence_steps").delete().eq("sequence_id", id);
            const stepRows = body.steps.map((s: { step_order: number; delay_days?: number; body_text: string }) => ({
                sequence_id: id,
                step_order: s.step_order,
                delay_days: typeof s.delay_days === "number" ? Math.max(0, Math.floor(s.delay_days)) : 0,
                body_text: String(s.body_text ?? "").trim(),
            }));
            const { error: stepsErr } = await supabase
                .from("sms_sequence_steps")
                .insert(stepRows);
            if (stepsErr) throw stepsErr;
        }

        return NextResponse.json({ data: { id }, message: "SMS sequence updated." });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS sequence update error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const isAdmin =
            isPlatformAdmin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const { id } = await params;

        const { data: existing, error: findErr } = await scopedTable(
            supabase,
            "sms_sequences",
            scope
        )
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const { error: delErr } = await applyTenantScope(
            supabase.from("sms_sequences").delete().eq("id", id),
            scope,
            "sms_sequences"
        );
        if (delErr) throw delErr;

        return NextResponse.json({ data: { id }, message: "SMS sequence deleted." });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS sequence delete error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
