import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { isResendConfigured } from "@/src/lib/resend";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const { id } = await params;

        const { data, error } = await scopedTable(
            supabase,
            "email_sequences",
            scope
        )
            .select("*, email_sequence_steps(*)")
            .eq("id", id)
            .maybeSingle();
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const steps = Array.isArray(data.email_sequence_steps)
            ? [...data.email_sequence_steps].sort(
                  (a: { step_order: number }, b: { step_order: number }) =>
                      a.step_order - b.step_order
              )
            : [];

        return NextResponse.json({
            data: { ...data, email_sequence_steps: steps },
            meta: { resend_configured: isResendConfigured() },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("email-sequences/[id] GET:", error);
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
