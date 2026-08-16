import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

/**
 * SMS activity log for a dealership (latest first, paginated).
 * Query params: limit, offset, direction, customer_id.
 */
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const url = new URL(req.url);
        const limit = Math.min(
            Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
            200
        );
        const offset = Math.max(
            parseInt(url.searchParams.get("offset") || "0", 10) || 0,
            0
        );
        const direction = url.searchParams.get("direction");
        const customerId = url.searchParams.get("customer_id");

        let query = applyTenantScope(
            supabase
                .from("sms_messages")
                .select(
                    "id, customer_id, direction, phone, body, status, provider, provider_sid, error, consent_checked, quiet_hours_blocked, sent_at, created_at, customer:customers(id, name)",
                    { count: "exact" }
                )
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "sms_messages"
        );

        if (direction === "outbound" || direction === "inbound") {
            query = query.eq("direction", direction);
        }
        if (customerId) {
            query = query.eq("customer_id", customerId);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS activity error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
