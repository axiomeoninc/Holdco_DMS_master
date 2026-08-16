// POST /api/leads/[id]/convert — one-click lead → sales_deals
import { NextRequest, NextResponse } from "next/server";
import {
    assertOwnershipOrDeny,
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { canCreate } from "@/src/lib/permission-middleware";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        if (!canCreate(auth.profile.role, auth.profile.user_permissions || [], "deals", auth.profile.is_platform_admin)) {
            return NextResponse.json(
                { error: "Forbidden - You cannot create deals" },
                { status: 403 }
            );
        }

        let supabase;
        try {
            supabase = pickSupabaseClient(req, auth.profile).supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            sale_price?: number;
            vehicle_id?: string;
        };

        const { data: lead, error: leadError } = await supabase
            .from("leads")
            .select(
                `*,
                vehicle:vehicles(id, retail_price, year, make, model, status),
                customer:customers(id, name)`
            )
            .eq("id", id)
            .single();

        if (leadError || !lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const deny = assertOwnershipOrDeny(lead, auth.profile);
        if (deny) return deny;

        if (lead.converted_deal_id) {
            return NextResponse.json(
                {
                    error: "Lead already converted",
                    deal_id: lead.converted_deal_id,
                    redirect: `/deals/${lead.converted_deal_id}`,
                },
                { status: 400 }
            );
        }

        if (!lead.customer_id) {
            return NextResponse.json(
                { error: "Lead needs a customer before converting" },
                { status: 400 }
            );
        }

        const vehicleId = body.vehicle_id || lead.interest_vehicle_id;
        if (!vehicleId) {
            return NextResponse.json(
                {
                    error: "Lead needs an interest vehicle — open New deal wizard to pick one",
                    redirect: `/deals/new?lead_id=${id}&customer_id=${lead.customer_id}`,
                    code: "NEEDS_VEHICLE",
                },
                { status: 400 }
            );
        }

        const vehicle = lead.vehicle as
            | { id: string; retail_price: number | null }
            | null
            | undefined;
        const salePrice =
            body.sale_price ??
            (vehicle && vehicle.id === vehicleId ? vehicle.retail_price : null) ??
            null;

        if (salePrice == null || Number(salePrice) <= 0) {
            return NextResponse.json(
                {
                    error: "Sale price required — open New deal wizard",
                    redirect: `/deals/new?lead_id=${id}&customer_id=${lead.customer_id}&vehicle_id=${vehicleId}`,
                    code: "NEEDS_PRICE",
                },
                { status: 400 }
            );
        }

        const dealData = {
            vehicle_id: vehicleId,
            customer_id: lead.customer_id,
            salesperson_id: lead.assigned_to || auth.profile.id,
            deal_status: "Negotiation",
            sale_price: Number(salePrice),
            down_payment: 0,
            trade_in_value: 0,
            notes: `Converted from lead ${id}${lead.notes ? `. ${lead.notes}` : ""}`,
            deal_date: new Date().toISOString().split("T")[0],
            dealership_id: lead.dealership_id || auth.profile.dealership_id,
        };

        const { data: deal, error: dealError } = await supabase
            .from("sales_deals")
            .insert(dealData)
            .select(
                `*,
                vehicle:vehicles(id, vin, year, make, model, retail_price, status),
                customer:customers(id, name, email, phone)`
            )
            .single();

        if (dealError) throw dealError;

        const { error: updateError } = await supabase
            .from("leads")
            .update({
                status: "Closed",
                converted_deal_id: deal.id,
                last_engagement: new Date().toISOString(),
            })
            .eq("id", id);

        if (updateError) throw updateError;

        // Light follow-up task (non-fatal if tasks schema differs)
        try {
            await supabase.from("tasks").insert({
                title: `Follow up on deal from lead`,
                description: `Auto-created when converting lead ${id} to deal ${deal.id}`,
                status: "Open",
                priority: "Medium",
                assigned_to: lead.assigned_to || auth.profile.id,
                dealership_id: lead.dealership_id || auth.profile.dealership_id,
                due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            });
        } catch {
            // ignore
        }

        return NextResponse.json(
            {
                data: { deal, lead_id: id },
                redirect: `/deals/${deal.id}`,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("lead convert POST:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 }
        );
    }
}
