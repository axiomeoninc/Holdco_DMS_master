// Equity triggers summary for inventory + CRM records.
// GET /api/equity/triggers
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    inventoryEquityCandidates,
    inventoryEquityTriggerText,
    crmEquityTriggers,
} from "@/src/lib/business/equity";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }

        const [vehicleRes, dealRes] = await Promise.all([
            supabaseAdmin
                .from("vehicles")
                .select(
                    "id, vin, stock_number, year, make, model, status, retail_price, created_at"
                )
                .eq("dealership_id", dealershipId)
                .limit(200),
            supabaseAdmin
                .from("sales_deals")
                .select(
                    `id, deal_status, trade_in_value, trade_in_payoff, customer_id, created_at,
                     customer:customers(id, name)`
                )
                .eq("dealership_id", dealershipId)
                .order("created_at", { ascending: false })
                .limit(200),
        ]);

        if (vehicleRes.error) throw vehicleRes.error;
        if (dealRes.error) throw dealRes.error;

        const candidates = inventoryEquityCandidates(vehicleRes.data ?? []);
        const deals = (dealRes.data ?? []).map((d) => ({
            ...d,
            // Supabase nested FK select returns an array — normalize to a single row.
            customer: Array.isArray(d.customer) ? d.customer[0] ?? null : d.customer,
        }));
        const customers = crmEquityTriggers(deals);

        return NextResponse.json({
            data: {
                inventory: {
                    count: candidates.length,
                    trigger_text: inventoryEquityTriggerText(candidates.length),
                    units: candidates.slice(0, 10).map((u) => ({
                        id: u.id,
                        vin: u.vin,
                        stock_number: u.stock_number,
                        label: [u.year, u.make, u.model].filter(Boolean).join(" "),
                        days_in_stock: u.days_in_stock,
                        retail_price: u.equity_hint,
                    })),
                },
                customers: {
                    count: customers.length,
                    trigger_text:
                        customers.length === 0
                            ? "No customers with trade-in equity to pull"
                            : `${customers.length} customer${customers.length === 1 ? "" : "s"} with trade-in equity`,
                    records: customers.slice(0, 10).map((c) => ({
                        customer_id: c.customer_id,
                        customer_name: c.customer_name,
                        deal_id: c.deal_id,
                        equity: c.equity,
                        class: c.class,
                        trade_value: c.trade_value,
                    })),
                },
            },
        });
    } catch (error: unknown) {
        console.error("[equity/triggers]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load equity triggers" },
            { status: 500 }
        );
    }
}
