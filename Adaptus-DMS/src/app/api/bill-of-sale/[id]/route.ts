// app/api/bill-of-sale/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    BILL_OF_SALE_ALLOWED_FIELDS,
    mapBillOfSaleLegacyFields,
} from "@/src/lib/bill-of-sale-fields";

// GET single bill of sale by ID
export async function GET(
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

        const supabase = supabaseAdmin;

        const { id } = await params;

        // Narrow fetch first to assert ownership
        const { data: existing, error: existingError } = await supabase
            .from("bill_of_sale")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Bill of sale not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Re-fetch the full row with relations
        const { data, error: dbError } = await supabase
            .from("bill_of_sale")
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status, condition, odometer),
                deal:sales_deals(
                    id, deal_status, sale_price, down_payment, finance_term, interest_rate, finance_company, salesperson_id,
                    customer:customers(id, name, email, phone, address, city, province, postal_code)
                )
            `)
            .eq("id", id)
            .single();

        if (dbError) throw dbError;

        // Fetch payments
        const { data: payments } = await supabase
            .from("bill_of_sale_payments")
            .select("*")
            .eq("bill_of_sale_id", id)
            .order("payment_date", { ascending: true });

        data.payments = payments || [];

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error fetching bill of sale:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update bill of sale
export async function PATCH(
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

        const supabase = supabaseAdmin;

        const { id } = await params;
        const payload = await req.json();

        // Extract payments if provided for update
        const payments = payload.payments;
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

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("bill_of_sale")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Bill of sale not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(cleanPayload, BILL_OF_SALE_ALLOWED_FIELDS);
        delete (safePayload as Record<string, unknown>).dealership_id;
        const mapped = mapBillOfSaleLegacyFields(safePayload, customerName);

        const { data, error: dbError } = await supabase
            .from("bill_of_sale")
            .update({
                ...mapped,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
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

        // Update payments if provided
        if (payments !== undefined) {
            // Delete existing payments
            await supabase
                .from("bill_of_sale_payments")
                .delete()
                .eq("bill_of_sale_id", id);

            // Insert new payments (must carry dealership_id for RLS WITH CHECK)
            if (payments.length > 0) {
                const paymentInserts = payments.map((p: Record<string, unknown>) => ({
                    ...p,
                    bill_of_sale_id: id,
                    dealership_id: existing.dealership_id,
                }));

                await supabase
                    .from("bill_of_sale_payments")
                    .insert(paymentInserts);
            }

            // Fetch updated payments
            const { data: updatedPayments } = await supabase
                .from("bill_of_sale_payments")
                .select("*")
                .eq("bill_of_sale_id", id)
                .order("payment_date", { ascending: true });

            data.payments = updatedPayments || [];
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating bill of sale:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE bill of sale
export async function DELETE(
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

        const supabase = supabaseAdmin;

        const { id } = await params;

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("bill_of_sale")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Bill of sale not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Delete payments first (cascade should handle this, but being explicit)
        await supabase
            .from("bill_of_sale_payments")
            .delete()
            .eq("bill_of_sale_id", id);

        const { error: dbError } = await supabase
            .from("bill_of_sale")
            .delete()
            .eq("id", id);

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting bill of sale:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
