// app/api/accounting/export/route.ts
// Accounting journal export: QuickBooks (IIF), Xero (journal CSV), Sage 50 (CSV).
// GET /api/accounting/export?format=quickbooks|xero|sage50&start_date=&end_date=
// Downloadable file responses; no external credentials required.

import { NextRequest, NextResponse } from "next/server";
import {
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { canExport } from "@/src/lib/permission-middleware";
import {
    ACCOUNTING_EXPORT_FORMATS,
    buildAccountingExport,
    buildJournalRows,
    isBalanced,
} from "@/src/lib/accounting";
import type {
    AccountingExportFormat,
    ExpenseInput,
    InvoiceInput,
    PurchaseInput,
    SaleInput,
} from "@/src/lib/accounting";

type SupabaseClient = ReturnType<typeof pickSupabaseClient>["supabase"];

async function fetchInvoices(
    supabase: SupabaseClient,
    dealershipId: string | null,
    startDay: string,
    endDay: string
): Promise<InvoiceInput[]> {
    let q = supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total, tax_amount, payment_amount, status, customer:customers(name)")
        .gte("invoice_date", startDay)
        .lte("invoice_date", endDay);
    if (dealershipId) q = q.eq("dealership_id", dealershipId);
    const { data } = await q;
    return (data || []) as InvoiceInput[];
}

async function fetchSales(
    supabase: SupabaseClient,
    dealershipId: string | null,
    startDay: string,
    endDay: string
): Promise<SaleInput[]> {
    let q = supabase
        .from("sales_deals")
        .select(
            "id, deal_date, sale_price, down_payment, total_price, deal_status, vehicle:vehicles(make, model, year), customer:customers(name)"
        )
        .gte("deal_date", startDay)
        .lte("deal_date", endDay);
    if (dealershipId) q = q.eq("dealership_id", dealershipId);
    const { data } = await q;
    return (data || []) as SaleInput[];
}

async function fetchExpenses(
    supabase: SupabaseClient,
    dealershipId: string | null,
    startDay: string,
    endDay: string
): Promise<ExpenseInput[]> {
    let q = supabase
        .from("expenses")
        .select(
            "id, expense_date, amount, tax_amount, category, description, status, reference_number, vendor:vendors(vendor_name)"
        )
        .gte("expense_date", startDay)
        .lte("expense_date", endDay);
    if (dealershipId) q = q.eq("dealership_id", dealershipId);
    const { data } = await q;
    return (data || []) as ExpenseInput[];
}

async function fetchPurchases(
    supabase: SupabaseClient,
    dealershipId: string | null,
    startDay: string,
    endDay: string
): Promise<PurchaseInput[]> {
    let q = supabase
        .from("purchase_from_public")
        .select(
            "id, purchase_date, purchase_price, seller_name, vin_verified, notes, vehicle:vehicles(make, model, year)"
        )
        .gte("purchase_date", startDay)
        .lte("purchase_date", endDay);
    if (dealershipId) q = q.eq("dealership_id", dealershipId);
    const { data } = await q;
    return (data || []) as PurchaseInput[];
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        if (
            !canExport(
                auth.profile.role,
                auth.profile.user_permissions || [],
                "reports"
            )
        ) {
            return NextResponse.json(
                { error: "Forbidden - Managers and admins can export accounting journals" },
                { status: 403 }
            );
        }

        const url = new URL(req.url);
        const formatParam = url.searchParams.get("format") || "quickbooks";
        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");

        if (!ACCOUNTING_EXPORT_FORMATS.includes(formatParam as AccountingExportFormat)) {
            return NextResponse.json(
                { error: `format must be one of: ${ACCOUNTING_EXPORT_FORMATS.join(", ")}` },
                { status: 400 }
            );
        }
        const format = formatParam as AccountingExportFormat;

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const dealershipId = auth.profile.dealership_id;

        const startDay = startDate || "2000-01-01";
        const endDay = endDate || (new Date().toISOString().split("T")[0] ?? "");

        const [invoices, sales, expenses, purchases] = await Promise.all([
            fetchInvoices(supabase, dealershipId, startDay, endDay),
            fetchSales(supabase, dealershipId, startDay, endDay),
            fetchExpenses(supabase, dealershipId, startDay, endDay),
            fetchPurchases(supabase, dealershipId, startDay, endDay),
        ]);

        const rows = buildJournalRows({ invoices, sales, expenses, purchases });
        if (rows.length === 0) {
            return NextResponse.json(
                { error: "No accounting activity in the selected date range" },
                { status: 422 }
            );
        }

        const result = buildAccountingExport(rows, format);
        const balanced = isBalanced(rows);

        return new NextResponse(result.content, {
            status: 200,
            headers: {
                "Content-Type": result.mimeType,
                "Content-Disposition": `attachment; filename="${result.filename}"`,
                "Cache-Control": "no-store",
                "X-Accounting-Rows": String(result.rowCount),
                "X-Accounting-Balanced": balanced ? "yes" : "no",
            },
        });
    } catch (error: unknown) {
        console.error("Accounting export error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}
