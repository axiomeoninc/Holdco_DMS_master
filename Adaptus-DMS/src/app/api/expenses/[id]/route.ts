// app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pickAllowed, requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

const EXPENSE_ALLOWED_FIELDS = [
    "category", "amount", "description", "status", "vendor_id",
    "expense_date", "due_date", "reference_number", "notes", "tax_amount",
    "payment_method", "vehicle_id",
] as const;

const EXPENSE_SELECT = `
                *,
                vendor:vendors(id, vendor_name, phone, gst_number, hst_number, pst_number, contact_name, contact_email, contact_phone),
                vehicle:vehicles(id, make, model, year, vin),
                entered_by_user:users!expenses_entered_by_fkey(id, full_name)
            `;

// GET single expense
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;

        const { data, error: dbError } = await scopedTable(
            supabase,
            "expenses",
            scope
        )
            .select(EXPENSE_SELECT)
            .eq("id", id)
            .maybeSingle();

        if (dbError) throw dbError;
        if (!data) {
            return NextResponse.json({ error: "Expense not found" }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching expense:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update expense
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;
        const payload = await req.json();

        const validStatuses = ['Pending', 'Approved', 'Paid', 'Cancelled'];
        if (payload.status && !validStatuses.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const validCategories = [
            'Vehicle Acquisition',
            'Repair & Maintenance',
            'Parts & Supplies',
            'Utilities',
            'Rent & Lease',
            'Insurance',
            'Marketing',
            'Office Supplies',
            'Professional Services',
            'Travel & Entertainment',
            'Payroll',
            'Taxes & Licenses',
            'Interest & Finance',
            'Miscellaneous'
        ];
        if (payload.category && !validCategories.includes(payload.category)) {
            return NextResponse.json(
                { error: `Invalid category.` },
                { status: 400 }
            );
        }

        const { data: existing, error: existingError } = await scopedTable(
            supabase,
            "expenses",
            scope
        )
            .select("id")
            .eq("id", id)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existing) {
            return NextResponse.json({ error: "Expense not found" }, { status: 404 });
        }

        const safePayload = pickAllowed(payload, EXPENSE_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        const { data, error: dbError } = await applyTenantScope(
            supabase
                .from("expenses")
                .update(safePayload)
                .eq("id", id)
                .select(EXPENSE_SELECT),
            scope,
            "expenses"
        ).single();

        if (dbError) throw dbError;
        if (!data) {
            return NextResponse.json({ error: "Expense not found" }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error updating expense:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE expense
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;

        const { data: existing, error: existingError } = await scopedTable(
            supabase,
            "expenses",
            scope
        )
            .select("id")
            .eq("id", id)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existing) {
            return NextResponse.json({ error: "Expense not found" }, { status: 404 });
        }

        const { error: dbError } = await applyTenantScope(
            supabase.from("expenses").delete().eq("id", id),
            scope,
            "expenses"
        );

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error deleting expense:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
