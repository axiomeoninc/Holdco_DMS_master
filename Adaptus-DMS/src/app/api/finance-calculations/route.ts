import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
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
        const vehicleId = url.searchParams.get("vehicle_id");
        const customerId = url.searchParams.get("customer_id");
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);

        let query = applyTenantScope(
            supabase
                .from("finance_calculations")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(Math.min(Math.max(limit, 1), 100)),
            scope,
            "finance_calculations"
        );

        if (vehicleId) {
            query = query.eq("vehicle_id", vehicleId);
        }
        if (customerId) {
            query = query.eq("customer_id", customerId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching finance calculations:", error);
        return NextResponse.json({ error: "Failed to fetch calculations" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        if (!currentUser.dealership_id) {
            return NextResponse.json(
                {
                    error:
                        "No dealership context — cannot save F&I worksheet without a dealership.",
                },
                { status: 403 }
            );
        }

        const body = (await req.json()) as Record<string, unknown>;

        if (body.sale_price === undefined || body.sale_price === null) {
            return NextResponse.json({ error: "sale_price is required" }, { status: 400 });
        }
        if (typeof body.sale_price !== "number" || Number.isNaN(body.sale_price) || body.sale_price < 0) {
            return NextResponse.json({ error: "sale_price must be a non-negative number" }, { status: 400 });
        }
        if (body.interest_rate === undefined || body.interest_rate === null) {
            return NextResponse.json({ error: "interest_rate is required" }, { status: 400 });
        }
        if (body.term_months === undefined || body.term_months === null) {
            return NextResponse.json({ error: "term_months is required" }, { status: 400 });
        }
        if (body.payment_amount === undefined || body.payment_amount === null) {
            return NextResponse.json({ error: "payment_amount is required" }, { status: 400 });
        }

        const paymentType = body.payment_type;
        if (
            paymentType !== undefined &&
            paymentType !== "monthly" &&
            paymentType !== "biweekly" &&
            paymentType !== "weekly"
        ) {
            return NextResponse.json(
                { error: "payment_type must be monthly, biweekly, or weekly" },
                { status: 400 }
            );
        }

        // Whitelist allowed fields (must match schema.sql finance_calculations columns)
        const allowed = [
            "vehicle_id", "customer_id", "sale_price",
            "down_payment", "trade_in_value", "interest_rate",
            "term_months", "payment_type", "payment_amount",
            "total_interest", "total_cost", "tax_amount", "admin_fee",
        ] as const;
        const calcData: Record<string, unknown> = {
            dealership_id: currentUser.dealership_id,
        };
        for (const field of allowed) {
            if (body[field] !== undefined) {
                calcData[field] = body[field];
            }
        }

        const { data, error } = await supabase
            .from("finance_calculations")
            .insert(calcData)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating finance calculation:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create calculation",
            },
            { status: 500 }
        );
    }
}
