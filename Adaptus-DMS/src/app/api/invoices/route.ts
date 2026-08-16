// app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { canCreate } from "@/src/lib/permission-middleware";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// GET all invoices
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");
        const q = url.searchParams.get("q");
        const invoiceDateFrom = url.searchParams.get("invoice_date_from");
        const invoiceDateTo = url.searchParams.get("invoice_date_to");

        let query = applyTenantScope(
            supabase
                .from("invoices")
                .select(`
                *,
                customer:customers(id, name, email, phone)
            `, { count: "exact" })
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "invoices"
        );

        if (status) query = query.eq("status", status);
        if (q) {
            // Search only on invoice columns since PostgREST doesn't support FK refs in .or()
            query = query.or(`invoice_number.ilike.%${q}%,notes.ilike.%${q}%`);
        }
        if (invoiceDateFrom) query = query.gte("invoice_date", invoiceDateFrom);
        if (invoiceDateTo) query = query.lte("invoice_date", invoiceDateTo);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        // Hydrate customer joins when PostgREST returns null but customer_id is set.
        const rows = data || [];
        const missingCustomerIds = [
            ...new Set(
                rows
                    .filter((row: { customer_id?: string | null; customer?: unknown }) =>
                        Boolean(row.customer_id) && !row.customer
                    )
                    .map((row: { customer_id: string }) => row.customer_id)
            ),
        ];
        if (missingCustomerIds.length > 0) {
            const customerLookup = applyTenantScope(
                supabase
                    .from("customers")
                    .select("id, name, email, phone")
                    .in("id", missingCustomerIds),
                scope,
                "customers"
            );
            const { data: foundCustomers } = await customerLookup;
            const byId = new Map(
                (foundCustomers || []).map((c: { id: string }) => [c.id, c])
            );
            for (const row of rows) {
                if (row.customer_id && !row.customer && byId.has(row.customer_id)) {
                    row.customer = byId.get(row.customer_id);
                }
            }
        }

        // Aggregate totals across the filtered set (not just the current page).
        let totalsQuery = applyTenantScope(
            supabase.from("invoices").select("total, status, due_date"),
            scope,
            "invoices"
        );
        if (status) totalsQuery = totalsQuery.eq("status", status);
        if (q) {
            totalsQuery = totalsQuery.or(
                `invoice_number.ilike.%${q}%,notes.ilike.%${q}%`
            );
        }
        if (invoiceDateFrom) totalsQuery = totalsQuery.gte("invoice_date", invoiceDateFrom);
        if (invoiceDateTo) totalsQuery = totalsQuery.lte("invoice_date", invoiceDateTo);

        const { data: totalsRows } = await totalsQuery;
        const now = Date.now();
        let pendingAmount = 0;
        let paidAmount = 0;
        let overdueAmount = 0;
        for (const row of totalsRows || []) {
            const line = Number(row.total || 0);
            if (row.status === "Paid") {
                paidAmount += line;
            } else if (row.status === "Cancelled") {
                // exclude from pending/overdue KPIs
            } else {
                pendingAmount += line;
                if (row.due_date && new Date(row.due_date).getTime() < now) {
                    overdueAmount += line;
                }
            }
        }

        return NextResponse.json({
            data: rows,
            count: count || 0,
            limit,
            offset,
            totals: {
                pendingAmount,
                paidAmount,
                overdueAmount,
            },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching invoices:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create invoice
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        if (!canCreate(currentUser.role, currentUser.user_permissions || [], "invoices", currentUser.is_platform_admin)) {
            return NextResponse.json(
                { error: "Forbidden - You cannot create invoices" },
                { status: 403 }
            );
        }

        const payload = await req.json();

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

        // Calculate tax and total if not provided
        const taxRate = payload.tax_rate !== undefined && payload.tax_rate !== null
            ? parseFloat(payload.tax_rate)
            : 13;
        const paymentAmount = parseFloat(payload.payment_amount) || 0;
        const taxAmount = payload.tax_amount !== undefined ? parseFloat(payload.tax_amount) : (paymentAmount * taxRate) / 100;
        const total = payload.total !== undefined ? parseFloat(payload.total) : paymentAmount + taxAmount;

        const writeScope = tenantScopeFromRequest(tenant, req);
        if (!currentUser.dealership_id && !currentUser.is_platform_admin) {
            return NextResponse.json(
                { error: "Unauthorized - No dealership context" },
                { status: 403 }
            );
        }

        // Tenant: customer must belong to the creating dealership (or platform may use customer's dealership).
        let customerQuery = supabase
            .from("customers")
            .select("id, dealership_id")
            .eq("id", payload.customer_id);
        customerQuery = applyTenantScope(customerQuery, writeScope, "customers");
        const { data: customerRow, error: customerError } = await customerQuery.maybeSingle();
        if (customerError) throw customerError;
        if (!customerRow) {
            return NextResponse.json(
                { error: "Customer not found in this dealership" },
                { status: 400 }
            );
        }

        const dealershipId = requireWriteDealershipId({
            ...writeScope,
            platformDealershipId:
                writeScope.platformDealershipId ||
                (customerRow.dealership_id as string | null),
        });

        const insertRow: Record<string, unknown> = {
            invoice_number: payload.invoice_number,
            customer_id: payload.customer_id,
            deal_id: payload.deal_id || null,
            invoice_date: payload.invoice_date || new Date().toISOString().split("T")[0],
            due_date: payload.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            payment_amount: paymentAmount,
            tax_rate: Number.isFinite(taxRate) ? taxRate : 13,
            tax_amount: taxAmount,
            total: total,
            amount_paid: 0,
            status: payload.status || "Pending",
            notes: payload.notes || null,
            package_name: payload.package_name ?? null,
            dealership_id: dealershipId,
        };

        // line_items allowed by schema (same as PUT whitelist on [id] route)
        if (payload.line_items !== undefined) {
            insertRow.line_items = payload.line_items;
        }

        const { data, error: dbError } = await supabase
            .from("invoices")
            .insert(insertRow)
            .select(`
                *,
                customer:customers(id, name, email, phone)
            `)
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating invoice:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
