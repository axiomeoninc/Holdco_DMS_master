// app/api/bill-of-sale/route.ts
import {
    BILL_OF_SALE_ALLOWED_FIELDS,
    mapBillOfSaleLegacyFields,
} from "@/src/lib/bill-of-sale-fields";
import { pickAllowed, requireTenantClient } from "@/src/lib/auth-helpers";
import { NextRequest, NextResponse } from "next/server";
import {
    applyTenantScope,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// GET all bills of sale
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const dealId = url.searchParams.get("deal_id");
        const status = url.searchParams.get("status");

        let query = applyTenantScope(
            supabase
                .from("bill_of_sale")
                .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery),
                deal:sales_deals(
                    id, deal_status, sale_price,
                    customer:customers(id, name, email, phone)
                )
            `, { count: "exact" })
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "bill_of_sale"
        );

        if (dealId) query = query.eq("deal_id", dealId);
        if (status) query = query.eq("status", status);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        // Fetch payments for each bill of sale
        if (data && data.length > 0) {
            const billIds = data.map((b) => b.id);
            const { data: payments, error: paymentsError } = await supabase
                .from("bill_of_sale_payments")
                .select("*")
                .in("bill_of_sale_id", billIds)
                .order("payment_date", { ascending: true });

            if (paymentsError) throw paymentsError;

            // Attach payments to each bill
            const paymentsByBill = (payments || []).reduce((acc, payment) => {
                if (!acc[payment.bill_of_sale_id]) {
                    acc[payment.bill_of_sale_id] = [];
                }
                acc[payment.bill_of_sale_id].push(payment);
                return acc;
            }, {});

            data.forEach((bill) => {
                bill.payments = paymentsByBill[bill.id] || [];
            });
        }

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
        console.error("Error fetching bills of sale:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create bill of sale
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        if (!currentUser.dealership_id && !currentUser.is_platform_admin) {
            return NextResponse.json(
                { error: "Unauthorized - No dealership context" },
                { status: 403 }
            );
        }

        if (!currentUser.dealership_id) {
            return NextResponse.json(
                {
                    error:
                        "Bill of sale requires a dealership context. Switch to a dealership before creating.",
                },
                { status: 400 }
            );
        }

        const payload = await req.json();

        // Extract payments before insert
        const payments = (payload.payments || []) as Array<{
            payment_name: string;
            payment_type: string;
            amount: number;
            payment_date: string;
        }>;
        const customerName =
            payload.buyer_name ||
            payload.customer?.name ||
            payload.customer_name ||
            null;

        delete payload.payments;
        delete payload.customer;
        delete payload.vehicle;
        delete payload.deal;
        delete payload.id;

        // Convert empty date strings to null
        const cleanPayload = { ...payload };
        if (cleanPayload.payment_start_date === "") {
            cleanPayload.payment_start_date = null;
        }

        const safePayload = pickAllowed(cleanPayload, BILL_OF_SALE_ALLOWED_FIELDS);
        // Never trust client dealership_id — RLS WITH CHECK requires tenant match
        delete (safePayload as Record<string, unknown>).dealership_id;
        const mapped = mapBillOfSaleLegacyFields(safePayload, customerName);

        const billData = {
            ...mapped,
            pst_rate: mapped.pst_rate ?? 7.0,
            status: mapped.status ?? "Draft",
            dealership_id: currentUser.dealership_id,
        };

        const { data, error: dbError } = await supabase
            .from("bill_of_sale")
            .insert(billData)
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery),
                deal:sales_deals(
                    id, deal_status, sale_price,
                    customer:customers(id, name, email, phone)
                )
            `)
            .single();

        if (dbError) throw dbError;

        // Insert payments if provided
        if (payments.length > 0) {
            const paymentInserts = payments.map((p) => ({
                ...p,
                bill_of_sale_id: data.id,
                dealership_id: currentUser.dealership_id,
            }));

            const { error: paymentsError } = await supabase
                .from("bill_of_sale_payments")
                .insert(paymentInserts);

            if (paymentsError) throw paymentsError;

            // Fetch inserted payments
            const { data: insertedPayments } = await supabase
                .from("bill_of_sale_payments")
                .select("*")
                .eq("bill_of_sale_id", data.id)
                .order("payment_date", { ascending: true });

            data.payments = insertedPayments || [];
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating bill of sale:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
