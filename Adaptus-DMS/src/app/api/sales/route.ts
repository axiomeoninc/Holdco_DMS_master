// app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");

        let query = applyTenantScope(
            supabase
                .from("sales_deals")
                .select(
                    `
                *,
                vehicle:vehicles(*),
                customer:customers(*),
                salesperson:users!sales_deals_salesperson_id_fkey(id,full_name,email)
            `,
                    { count: "exact" }
                )
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "sales_deals"
        );

        if (status) query = query.eq("deal_status", status);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

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
        console.error("Error fetching sales deals:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const user = auth.user;
        const writeScope = tenantScopeFromRequest(tenant, req);
        const rooftop = requireWriteDealershipId(writeScope);

        const payload = await req.json();
        const required = ["vehicle_id", "customer_id", "sale_price"];

        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        const { data: vehicleRow } = await scopedTable(
            supabase,
            "vehicles",
            writeScope
        )
            .select("id")
            .eq("id", payload.vehicle_id)
            .maybeSingle();
        if (!vehicleRow) {
            return NextResponse.json(
                { error: "Vehicle not found in this dealership" },
                { status: 400 }
            );
        }

        const { data: customerRow } = await scopedTable(
            supabase,
            "customers",
            writeScope
        )
            .select("id")
            .eq("id", payload.customer_id)
            .maybeSingle();
        if (!customerRow) {
            return NextResponse.json(
                { error: "Customer not found in this dealership" },
                { status: 400 }
            );
        }

        payload.deal_date = payload.deal_date || new Date().toISOString().split("T")[0];
        payload.down_payment = payload.down_payment || 0;

        if (!payload.salesperson_id) {
            payload.salesperson_id = user.id;
        }

        payload.dealership_id = rooftop;

        const { data, error: dbError } = await supabase
            .from("sales_deals")
            .insert(payload)
            .select()
            .single();

        if (dbError) throw dbError;

        await applyTenantScope(
            supabase
                .from("vehicles")
                .update({ status: "Sold" })
                .eq("id", payload.vehicle_id),
            writeScope,
            "vehicles"
        );

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating sales deal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
