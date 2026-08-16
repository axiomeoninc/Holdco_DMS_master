// app/api/quotations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, pickSupabaseClient, requireDealershipAccess } from "@/src/lib/auth-helpers";

const QUOTE_ALLOWED_FIELDS = [
    "quote_number", "customer_id", "vehicle_id", "salesperson_id", "status",
    "sale_price", "down_payment", "trade_in_value", "finance_term", "interest_rate",
    "finance_company", "tax_rate", "admin_fee", "monthly_payment", "notes",
    "valid_until", "converted_deal_id",
] as const;

const VALID_STATUSES = ["Draft", "Sent", "Accepted", "Expired", "Converted", "Cancelled"];

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
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
            .select("id, dealership_id, salesperson_id")
            .eq("id", id)
            .single();

        if (quoteError || !quote) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        const deny = assertOwnershipOrDeny(quote, auth.profile);
        if (deny) return deny;

        const { data, error: dbError } = await supabase
            .from("quotations")
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status),
                customer:customers(id, name, email, phone, address, city, province),
                salesperson:users!quotations_salesperson_id_fkey(id, full_name, email)
            `)
            .eq("id", id)
            .single();

        if (dbError) throw dbError;
        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error fetching quotation:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
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
        const payload = await req.json();

        if (payload.status && !VALID_STATUSES.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

        const { data: existing, error: existingError } = await supabase
            .from("quotations")
            .select("id, dealership_id, salesperson_id")
            .eq("id", id)
            .single();

        if (existingError || !existing) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const updateData = pickAllowed(payload, QUOTE_ALLOWED_FIELDS);
        delete (updateData as { dealership_id?: string }).dealership_id;

        const { data, error: dbError } = await supabase
            .from("quotations")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status),
                customer:customers(id, name, email, phone),
                salesperson:users!quotations_salesperson_id_fkey(id, full_name, email)
            `)
            .single();

        if (dbError) throw dbError;
        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating quotation:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
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
        const { data: existing, error: existingError } = await supabase
            .from("quotations")
            .select("id, dealership_id, salesperson_id, status")
            .eq("id", id)
            .single();

        if (existingError || !existing) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        if (existing.status === "Converted") {
            return NextResponse.json(
                { error: "Cannot delete a converted quotation" },
                { status: 400 }
            );
        }

        const { error: dbError } = await supabase.from("quotations").delete().eq("id", id);
        if (dbError) throw dbError;

        return NextResponse.json({ success: true, message: "Quotation deleted successfully" });
    } catch (error: unknown) {
        console.error("Error deleting quotation:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
