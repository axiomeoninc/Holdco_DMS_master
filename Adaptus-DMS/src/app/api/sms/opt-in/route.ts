import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { applyConsentTimestamps } from "@/src/lib/customer-consent";

/**
 * SMS opt-in — records CASL/TCPA consent at point of capture.
 * Body: { customer_id, consent: boolean }
 * Stamps sms_consent, sms_consent_at (+ ip) via the shared consent helper.
 */
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const body = await req.json().catch(() => ({}));
        const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
        if (!customerId) {
            return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
        }
        if (typeof body.consent !== "boolean") {
            return NextResponse.json({ error: "consent (boolean) is required" }, { status: 400 });
        }

        const { data: customer, error } = await scopedTable(
            supabase,
            "customers",
            scope
        )
            .select("id, dealership_id, sms_consent, sms_consent_at, sms_consent_ip")
            .eq("id", customerId)
            .maybeSingle();

        if (error || !customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const ip =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        const next = applyConsentTimestamps(
            { sms_consent: body.consent },
            customer,
            { ip }
        );

        const { data: updated, error: updateError } = await applyTenantScope(
            supabase
                .from("customers")
                .update(next)
                .eq("id", customerId)
                .select("id, sms_consent, sms_consent_at, sms_consent_ip"),
            scope,
            "customers"
        ).single();

        if (updateError) throw updateError;

        return NextResponse.json({
            data: updated,
            message: body.consent
                ? "SMS consent recorded."
                : "SMS consent revoked.",
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS opt-in error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
