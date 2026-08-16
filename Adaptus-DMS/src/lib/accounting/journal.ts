/**
 * Journal builder: converts dealership financial activity (sales, invoices,
 * expenses, purchases) into balanced double-entry journal rows.
 *
 * This is an export-oriented journal, not a general ledger — the goal is to
 * hand an accountant a clean, balanced dataset that maps to their chart of
 * accounts. Account names match QuickBooks/Xero/Sage conventions; dealers can
 * remap them in their accounting package.
 */

import type { JournalRow } from "./types";

function num(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function dayOnly(iso: string | null | undefined): string {
    if (!iso) return new Date().toISOString().split("T")[0] ?? "";
    const s = String(iso);
    return s.includes("T") ? s.split("T")[0]! : s;
}

export interface SaleInput {
    id: string;
    deal_date?: string | null;
    sale_price?: number | null;
    down_payment?: number | null;
    total_price?: number | null;
    deal_status?: string | null;
    vehicle?: { make?: string | null; model?: string | null; year?: number | null } | Array<{ make?: string | null; model?: string | null; year?: number | null }> | null;
    customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
}

export interface InvoiceInput {
    id: string;
    invoice_number?: string | null;
    invoice_date?: string | null;
    total?: number | null;
    tax_amount?: number | null;
    payment_amount?: number | null;
    status?: string | null;
    customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
}

export interface ExpenseInput {
    id: string;
    expense_date?: string | null;
    amount?: number | null;
    tax_amount?: number | null;
    category?: string | null;
    description?: string | null;
    status?: string | null;
    reference_number?: string | null;
    vendor?: { vendor_name?: string | null } | Array<{ vendor_name?: string | null }> | null;
}

export interface PurchaseInput {
    id: string;
    purchase_date?: string | null;
    purchase_price?: number | null;
    seller_name?: string | null;
    vin_verified?: boolean | null;
    notes?: string | null;
    vehicle?: { make?: string | null; model?: string | null; year?: number | null } | Array<{ make?: string | null; model?: string | null; year?: number | null }> | null;
}

function nameOf(
    ref:
        | { name?: string | null }
        | Array<{ name?: string | null }>
        | { vendor_name?: string | null }
        | Array<{ vendor_name?: string | null }>
        | null
        | undefined
): string | null {
    if (!ref) return null;
    const row = Array.isArray(ref) ? ref[0] : ref;
    if (!row) return null;
    const n = "vendor_name" in row ? row.vendor_name : "name" in row ? row.name : null;
    return n || null;
}

function vehicleLabel(
    v: SaleInput["vehicle"] | PurchaseInput["vehicle"]
): string | null {
    if (!v) return null;
    const row = Array.isArray(v) ? v[0] : v;
    if (!row) return null;
    return [row.year, row.make, row.model].filter(Boolean).join(" ") || null;
}

/**
 * Build journal rows for a batch of invoices.
 * Dr: Accounts Receivable (total) / Cr: Sales Revenue (subtotal) + Tax Collected.
 */
export function buildInvoiceJournalRows(invoices: InvoiceInput[]): JournalRow[] {
    const rows: JournalRow[] = [];
    for (const inv of invoices) {
        const total = num(inv.total);
        if (total === 0) continue;
        const tax = num(inv.tax_amount);
        const ref = inv.invoice_number || `INV-${inv.id.slice(0, 8)}`;
        const date = dayOnly(inv.invoice_date);
        const customer = nameOf(inv.customer);
        const memo = `Invoice ${ref}`;

        rows.push({
            referenceNumber: ref,
            date,
            account: "Accounts Receivable",
            debit: total,
            credit: 0,
            memo,
            customer,
            sourceType: "invoice",
        });
        rows.push({
            referenceNumber: ref,
            date,
            account: "Sales Revenue",
            debit: 0,
            credit: Math.max(0, total - tax),
            memo,
            customer,
            sourceType: "invoice",
        });
        if (tax !== 0) {
            rows.push({
                referenceNumber: ref,
                date,
                account: "Tax Collected",
                debit: 0,
                credit: tax,
                memo,
                customer,
                sourceType: "invoice",
            });
        }
    }
    return rows;
}

/**
 * Build journal rows for closed deals (cash / financed sales).
 * Dr: Cash or Accounts Receivable / Cr: Sales Revenue + Tax Collected.
 */
export function buildSaleJournalRows(sales: SaleInput[]): JournalRow[] {
    const rows: JournalRow[] = [];
    const excluded = new Set(["Cancelled", "Lost", "Negotiation"]);
    for (const sale of sales) {
        if (sale.deal_status && excluded.has(sale.deal_status)) continue;
        const total = num(sale.total_price) || num(sale.sale_price);
        if (total === 0) continue;
        const ref = `DEAL-${sale.id.slice(0, 8)}`;
        const date = dayOnly(sale.deal_date);
        const customer = nameOf(sale.customer);
        const veh = vehicleLabel(sale.vehicle);
        const memo = [`Deal ${ref}`, veh ? `(${veh})` : ""].filter(Boolean).join(" ");

        // Conservatively treat all as accounts-receivable sales: an accountant
        // can reclassify to Cash by clearing the receivable against payments.
        rows.push({
            referenceNumber: ref,
            date,
            account: "Accounts Receivable",
            debit: total,
            credit: 0,
            memo,
            customer,
            sourceType: "sale",
        });
        rows.push({
            referenceNumber: ref,
            date,
            account: "Sales Revenue",
            debit: 0,
            credit: total,
            memo,
            customer,
            sourceType: "sale",
        });
    }
    return rows;
}

/**
 * Build journal rows for paid expenses.
 * Dr: Expense account (incl. tax) / Cr: Accounts Payable or Cash.
 */
export function buildExpenseJournalRows(expenses: ExpenseInput[]): JournalRow[] {
    const rows: JournalRow[] = [];
    for (const exp of expenses) {
        if (exp.status && exp.status !== "Paid") continue;
        const amount = num(exp.amount);
        if (amount === 0) continue;
        const tax = num(exp.tax_amount);
        const total = amount + tax;
        const category = exp.category || "General Expenses";
        const account = category.endsWith("Expense") || category.endsWith("expenses")
            ? category
            : `${category} Expenses`;
        const vendor = nameOf(exp.vendor);
        const ref = exp.reference_number || exp.description || `EXP-${exp.id.slice(0, 8)}`;
        const date = dayOnly(exp.expense_date);
        const memo = exp.description || `Expense ${ref}`;

        rows.push({
            referenceNumber: ref,
            date,
            account,
            debit: total,
            credit: 0,
            memo,
            customer: vendor,
            sourceType: "expense",
        });
        rows.push({
            referenceNumber: ref,
            date,
            account: "Accounts Payable",
            debit: 0,
            credit: total,
            memo,
            customer: vendor,
            sourceType: "expense",
        });
    }
    return rows;
}

/**
 * Build journal rows for vehicle purchases from the public.
 * Dr: Inventory (Vehicle Purchases) / Cr: Accounts Payable.
 */
export function buildPurchaseJournalRows(purchases: PurchaseInput[]): JournalRow[] {
    const rows: JournalRow[] = [];
    for (const purchase of purchases) {
        const amount = num(purchase.purchase_price);
        if (amount === 0) continue;
        const ref = `PURCH-${purchase.id.slice(0, 8)}`;
        const date = dayOnly(purchase.purchase_date);
        const seller = purchase.seller_name || null;
        const veh = vehicleLabel(purchase.vehicle);
        const memo = [`Purchase ${ref}`, veh ? `(${veh})` : ""].filter(Boolean).join(" ");

        rows.push({
            referenceNumber: ref,
            date,
            account: "Inventory - Vehicle Purchases",
            debit: amount,
            credit: 0,
            memo,
            customer: seller,
            sourceType: "purchase",
        });
        rows.push({
            referenceNumber: ref,
            date,
            account: "Accounts Payable",
            debit: 0,
            credit: amount,
            memo,
            customer: seller,
            sourceType: "purchase",
        });
    }
    return rows;
}

/** Convenience: build all source types into one ordered row set. */
export function buildJournalRows(input: {
    invoices?: InvoiceInput[];
    sales?: SaleInput[];
    expenses?: ExpenseInput[];
    purchases?: PurchaseInput[];
}): JournalRow[] {
    return [
        ...buildInvoiceJournalRows(input.invoices || []),
        ...buildSaleJournalRows(input.sales || []),
        ...buildExpenseJournalRows(input.expenses || []),
        ...buildPurchaseJournalRows(input.purchases || []),
    ];
}

/** Basic balanced-ness sanity check (useful in tests / debug). */
export function isBalanced(rows: JournalRow[]): boolean {
    const totalDebits = rows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredits = rows.reduce((sum, r) => sum + r.credit, 0);
    return Math.abs(totalDebits - totalCredits) < 0.009;
}
