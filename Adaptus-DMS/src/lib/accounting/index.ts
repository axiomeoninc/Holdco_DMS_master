/**
 * Accounting export module — journal exports for QuickBooks (IIF), Xero
 * (journal CSV) and Sage 50 (CSV). Data is transformed from dealership
 * financial activity (sales / invoices / expenses / purchases).
 */

export * from "./types";
export * from "./journal";
export * from "./quickbooks";
export * from "./xero";
export * from "./sage50";

import type { JournalRow, AccountingExportFormat, AccountingExportResult } from "./types";
import { buildQuickbooksIif } from "./quickbooks";
import { buildXeroJournalCsv } from "./xero";
import { buildSage50Csv } from "./sage50";

const FILENAME_MAP: Record<AccountingExportFormat, string> = {
    quickbooks: "flashfender-journal.IIF",
    xero: "flashfender-journal-xero.csv",
    sage50: "flashfender-journal-sage50.csv",
};

const MIME_MAP: Record<AccountingExportFormat, string> = {
    quickbooks: "text/tab-separated-values",
    xero: "text/csv",
    sage50: "text/csv",
};

/**
 * Serialize balanced journal rows to the requested accounting format.
 * Throws for unknown formats so callers never emit an empty/odd file.
 */
export function buildAccountingExport(
    rows: JournalRow[],
    format: AccountingExportFormat
): AccountingExportResult {
    let content: string;
    switch (format) {
        case "quickbooks":
            content = buildQuickbooksIif(rows);
            break;
        case "xero":
            content = buildXeroJournalCsv(rows);
            break;
        case "sage50":
            content = buildSage50Csv(rows);
            break;
        default: {
            const exhaustive: never = format;
            throw new Error(`Unsupported accounting export format: ${String(exhaustive)}`);
        }
    }
    return {
        filename: FILENAME_MAP[format],
        mimeType: MIME_MAP[format],
        content,
        format,
        rowCount: rows.length,
    };
}
