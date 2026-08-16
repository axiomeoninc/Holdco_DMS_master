// app/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// GET all expenses
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const category = url.searchParams.get("category");
        const status = url.searchParams.get("status");
        const vendor_id = url.searchParams.get("vendor_id");
        const startDate = url.searchParams.get("expense_date_from");
        const endDate = url.searchParams.get("expense_date_to");
        const q = url.searchParams.get("q");

        let query = applyTenantScope(
            supabase
            .from("expenses")
            .select(`
                *,
                vendor:vendors(id, vendor_name, phone, gst_number, hst_number, pst_number),
                vehicle:vehicles(id, make, model, year, vin),
                entered_by_user:users!expenses_entered_by_fkey(id, full_name)
            `, { count: "exact" })
            .order("expense_date", { ascending: false })
            .range(offset, offset + limit - 1),
            scope,
            "expenses"
        );

        if (category) query = query.eq("category", category);
        if (status) query = query.eq("status", status);
        if (vendor_id) query = query.eq("vendor_id", vendor_id);
        if (startDate) query = query.gte("expense_date", startDate);
        if (endDate) query = query.lte("expense_date", endDate);
        if (q) {
            query = query.or(`description.ilike.%${q}%,reference_number.ilike.%${q}%`);
        }

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        // Aggregate totals across the filtered set (not just the current page).
        let totalsQuery = applyTenantScope(
            supabase.from("expenses").select("amount, tax_amount, status, due_date"),
            scope,
            "expenses"
        );
        if (category) totalsQuery = totalsQuery.eq("category", category);
        if (status) totalsQuery = totalsQuery.eq("status", status);
        if (vendor_id) totalsQuery = totalsQuery.eq("vendor_id", vendor_id);
        if (startDate) totalsQuery = totalsQuery.gte("expense_date", startDate);
        if (endDate) totalsQuery = totalsQuery.lte("expense_date", endDate);
        if (q) {
            totalsQuery = totalsQuery.or(
                `description.ilike.%${q}%,reference_number.ilike.%${q}%`
            );
        }

        const { data: totalsRows } = await totalsQuery;
        const now = Date.now();
        let totalAmount = 0;
        let pendingAmount = 0;
        let paidAmount = 0;
        let overdueCount = 0;
        for (const row of totalsRows || []) {
            const line = Number(row.amount || 0) + Number(row.tax_amount || 0);
            totalAmount += line;
            if (row.status === "Pending") {
                pendingAmount += line;
                if (row.due_date && new Date(row.due_date).getTime() < now) {
                    overdueCount += 1;
                }
            } else if (row.status === "Paid") {
                paidAmount += line;
            }
        }

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
            totals: {
                totalAmount,
                pendingAmount,
                paidAmount,
                overdueCount,
            },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching expenses:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create expense
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const user = auth.user;
        const writeScope = tenantScopeFromRequest(tenant, req);

        const payload = await req.json();

        // Validate required fields
        if (!payload.amount || payload.amount <= 0) {
            return NextResponse.json(
                { error: "Amount must be greater than 0" },
                { status: 400 }
            );
        }

        if (!payload.category) {
            return NextResponse.json(
                { error: "Category is required" },
                { status: 400 }
            );
        }

        if (!payload.expense_date) {
            return NextResponse.json(
                { error: "Expense date is required" },
                { status: 400 }
            );
        }

        // Validate status if provided
        const validStatuses = ['Pending', 'Approved', 'Paid', 'Cancelled'];
        if (payload.status && !validStatuses.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate category
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
        if (!validCategories.includes(payload.category)) {
            return NextResponse.json(
                { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
                { status: 400 }
            );
        }

        const rooftop = requireWriteDealershipId(writeScope);

        // Reject cross-tenant vendor / vehicle links
        if (payload.vendor_id) {
            const { data: vendorRow } = await scopedTable(
                supabase,
                "vendors",
                writeScope
            )
                .select("id")
                .eq("id", payload.vendor_id)
                .maybeSingle();
            if (!vendorRow) {
                return NextResponse.json(
                    { error: "Vendor not found in this dealership" },
                    { status: 400 }
                );
            }
        }
        if (payload.vehicle_id) {
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
        }

        const expenseData = {
            description: payload.description || null,
            amount: payload.amount,
            category: payload.category,
            vendor_id: payload.vendor_id || null,
            vehicle_id: payload.vehicle_id || null,
            expense_date: payload.expense_date,
            due_date: payload.due_date || null,
            status: payload.status || 'Pending',
            reference_number: payload.reference_number || null,
            notes: payload.notes || null,
            entered_by: user.id,
            tax_amount: payload.tax_amount || 0,
            payment_method: payload.payment_method || null,
            dealership_id: rooftop,
        };

        const { data, error: dbError } = await supabase
            .from("expenses")
            .insert(expenseData)
            .select(`
                *,
                vendor:vendors(id, vendor_name, phone, gst_number, hst_number, pst_number),
                vehicle:vehicles(id, make, model, year, vin),
                entered_by_user:users!expenses_entered_by_fkey(id, full_name)
            `)
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating expense:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
