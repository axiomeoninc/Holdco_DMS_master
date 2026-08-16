// app/api/quotations/[id]/convert/route.ts
// Convert a quotation into a sales_deals row and mark quote Converted.
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickSupabaseClient, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { canCreate } from "@/src/lib/permission-middleware";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        if (!canCreate(auth.profile.role, auth.profile.user_permissions || [], "deals", auth.profile.is_platform_admin)) {
            return NextResponse.json({ error: "Forbidden - You cannot create deals" }, { status: 403 });
        }

        let supabase;
        try {
            supabase = pickSupabaseClient(req, auth.profile).supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json({ error: "Authorization token required" }, { status: 401 });
            }
            throw error;
        }

        const { id } = await params;
        const { data: quote, error: quoteError } = await supabase
            .from("quotations")
            .select("*")
            .eq("id", id)
            .single();

        if (quoteError || !quote) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        const deny = assertOwnershipOrDeny(quote, auth.profile);
        if (deny) return deny;

        if (quote.status === "Converted" && quote.converted_deal_id) {
            return NextResponse.json(
                { error: "Quotation already converted", deal_id: quote.converted_deal_id },
                { status: 400 }
            );
        }

        if (!quote.vehicle_id) {
            return NextResponse.json({ error: "Quotation needs a vehicle before converting" }, { status: 400 });
        }
        if (!quote.customer_id) {
            return NextResponse.json({ error: "Quotation needs a customer before converting" }, { status: 400 });
        }
        if (!quote.sale_price && quote.sale_price !== 0) {
            return NextResponse.json({ error: "Quotation needs a sale price" }, { status: 400 });
        }

        const dealData = {
            vehicle_id: quote.vehicle_id,
            customer_id: quote.customer_id,
            salesperson_id: quote.salesperson_id || auth.profile.id,
            deal_status: "Negotiation",
            sale_price: quote.sale_price,
            down_payment: quote.down_payment ?? 0,
            trade_in_value: quote.trade_in_value ?? 0,
            finance_term: quote.finance_term ?? null,
            interest_rate: quote.interest_rate ?? null,
            finance_company: quote.finance_company || null,
            notes: quote.notes
                ? `Converted from quote ${quote.quote_number || id}. ${quote.notes}`
                : `Converted from quote ${quote.quote_number || id}`,
            deal_date: new Date().toISOString().split("T")[0],
            dealership_id: quote.dealership_id || auth.profile.dealership_id,
        };

        const { data: deal, error: dealError } = await supabase
            .from("sales_deals")
            .insert(dealData)
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, status),
                customer:customers(id, name, email, phone)
            `)
            .single();

        if (dealError) throw dealError;

        const { data: updatedQuote, error: updateError } = await supabase
            .from("quotations")
            .update({
                status: "Converted",
                converted_deal_id: deal.id,
            })
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) throw updateError;

        return NextResponse.json({
            data: {
                deal,
                quotation: updatedQuote,
            },
        }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error converting quotation:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
