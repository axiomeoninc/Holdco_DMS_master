/**
 * Accounting export shared types.
 * Journal export targets: QuickBooks (IIF), Xero (journal CSV), Sage 50 (CSV).
 */

export type AccountingExportFormat = "quickbooks" | "xero" | "sage50";

export const ACCOUNTING_EXPORT_FORMATS: AccountingExportFormat[] = [
    "quickbooks",
    "xero",
    "sage50",
];

export interface AccountingSourceRef {
    referenceNumber: string;
    date: string; // YYYY-MM-DD
    memo: string;
    customer?: string | null;
}

/**
 * One double-entry journal row. The API layer emits balanced debits/credits
 * for each source transaction; exporters serialize to the target format.
 */
export interface JournalRow {
    referenceNumber: string;
    date: string; // YYYY-MM-DD
    account: string; // chart account name (e.g. "Accounts Receivable")
    accountCode?: string; // optional external chart account code
    debit: number;
    credit: number;
    memo: string;
    customer?: string | null;
    sourceType: "sale" | "invoice" | "expense" | "purchase";
}

export interface AccountingExportResult {
    filename: string;
    mimeType: string;
    content: string;
    format: AccountingExportFormat;
    rowCount: number;
}

export interface AccountingSourceCounts {
    invoices: number;
    sales: number;
    expenses: number;
    purchases: number;
}
