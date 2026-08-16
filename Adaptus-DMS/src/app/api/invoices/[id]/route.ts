// app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { canDelete, canEdit } from "@/src/lib/permission-middleware";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const INVOICE_ALLOWED_FIELDS = [
    "customer_id", "deal_id", "package_name", "tax_rate", "status",
    "due_date", "notes", "line_items", "invoice_number", "invoice_date",
    "payment_amount",
] as const;

async function assertCustomerInDealership(
    supabase: typeof supabaseAdmin,
    customerId: string,
    dealershipId: string | null | undefined,
    isPlatformAdmin: boolean | null | undefined
): Promise<NextResponse | null> {
    if (!customerId) {
        return NextResponse.json(
            { error: "Missing required field: customer_id" },
            { status: 400 }
        );
    }
    let q = supabase
        .from("customers")
        .select("id, dealership_id")
        .eq("id", customerId);
    if (!isPlatformAdmin && dealershipId) {
        q = q.eq("dealership_id", dealershipId);
    }
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    if (!data) {
        return NextResponse.json(
            { error: "Customer not found in this dealership" },
            { status: 400 }
        );
    }
    return null;
}

// GET single invoice
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
            .from("invoices")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Re-fetch the full row with relations now that ownership is verified
        const { data, error: dbError } = await supabase
            .from("invoices")
            .select(`
                *,
                customer:customers(id, name, email, phone, address, city, province)
            `)
            .eq("id", id)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error fetching invoice:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT update invoice (full update)
export async function PUT(
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

        if (
            !canEdit(
                auth.profile.role,
                auth.profile.user_permissions || [],
                "invoices",
                auth.profile.is_platform_admin
            )
        ) {
            return NextResponse.json(
                { error: "Forbidden - You cannot edit invoices" },
                { status: 403 }
            );
        }

        // Validate required fields
        const required = ["invoice_number", "customer_id", "payment_amount"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Validate status if provided
        const validStatuses = ['Pending', 'Paid', 'Overdue', 'Cancelled'];
        if (payload.status && !validStatuses.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("invoices")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const customerDeny = await assertCustomerInDealership(
            supabase,
            payload.customer_id,
            auth.profile.dealership_id || existing.dealership_id,
            auth.profile.is_platform_admin
        );
        if (customerDeny) return customerDeny;

        // Recalculate tax and total
        const taxRate = payload.tax_rate ?? 13;
        const paymentAmount = parseFloat(payload.payment_amount) || 0;
        const taxAmount = (paymentAmount * taxRate) / 100;
        const total = paymentAmount + taxAmount;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, INVOICE_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        const { data, error: dbError } = await supabase
            .from("invoices")
            .update({
                ...safePayload,
                payment_amount: paymentAmount,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total: total,
            })
            .eq("id", id)
            .select(`
                *,
                customer:customers(id, name, email, phone)
            `)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating invoice:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update invoice (partial update)
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

        if (
            !canEdit(
                auth.profile.role,
                auth.profile.user_permissions || [],
                "invoices",
                auth.profile.is_platform_admin
            )
        ) {
            return NextResponse.json(
                { error: "Forbidden - You cannot edit invoices" },
                { status: 403 }
            );
        }

        // Validate status if being updated
        if (payload.status) {
            const validStatuses = ['Pending', 'Paid', 'Overdue', 'Cancelled'];
            if (!validStatuses.includes(payload.status)) {
                return NextResponse.json(
                    { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                    { status: 400 }
                );
            }
        }

        // Assert ownership before any write (include tax_rate for recalc)
        const { data: existing, error: existingError } = await supabase
            .from("invoices")
            .select("id, dealership_id, tax_rate, payment_amount")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        if (payload.customer_id) {
            const customerDeny = await assertCustomerInDealership(
                supabase,
                payload.customer_id,
                auth.profile.dealership_id || existing.dealership_id,
                auth.profile.is_platform_admin
            );
            if (customerDeny) return customerDeny;
        }

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, INVOICE_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        // If payment_amount is being updated, recalculate tax and total
        const updates: Record<string, unknown> = { ...safePayload };
        if (payload.payment_amount !== undefined) {
            const paymentAmount = parseFloat(payload.payment_amount) || 0;
            const taxRate =
                payload.tax_rate !== undefined && payload.tax_rate !== null
                    ? parseFloat(payload.tax_rate)
                    : Number(existing.tax_rate) || 13;
            updates.tax_rate = taxRate;
            updates.tax_amount = (paymentAmount * taxRate) / 100;
            updates.total = paymentAmount + (updates.tax_amount as number);
            updates.payment_amount = paymentAmount;
        } else if (payload.tax_rate !== undefined && payload.tax_rate !== null) {
            const paymentAmount = Number(existing.payment_amount) || 0;
            const taxRate = parseFloat(payload.tax_rate);
            updates.tax_rate = taxRate;
            updates.tax_amount = (paymentAmount * taxRate) / 100;
            updates.total = paymentAmount + (updates.tax_amount as number);
        }

        const { data, error: dbError } = await supabase
            .from("invoices")
            .update(updates)
            .eq("id", id)
            .select(`
                *,
                customer:customers(id, name, email, phone)
            `)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating invoice:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE invoice
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

        if (
            !canDelete(
                auth.profile.role,
                auth.profile.user_permissions || [],
                "invoices",
                auth.profile.is_platform_admin
            )
        ) {
            return NextResponse.json(
                { error: "Forbidden - You cannot delete invoices" },
                { status: 403 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("invoices")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const { error: dbError } = await supabase
            .from("invoices")
            .delete()
            .eq("id", id);

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            message: "Invoice deleted successfully"
        });
    } catch (error: unknown) {
        console.error("Error deleting invoice:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
