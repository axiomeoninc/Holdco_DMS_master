/**
 * Sage 50 export: general journal CSV compatible with Sage 50 Accounting
 * journal import (Accounts Payable ledger / GL journal batch).
 *
 * Column layout is intentionally simple and accountant-readable:
 *   Date, Reference, Account, Debit, Credit, Memo, Customer/Supplier
 */

import type { JournalRow } from "./types";

function fmt(n: number): string {
    return n.toFixed(2);
}

function datePart(date: string): string {
    return date.includes("T") ? date.split("T")[0]! : date;
}

function esc(value: unknown): string {
    const s = String(value ?? "")
        .replace(/\r?\n/g, " ")
        .replace(/\t/g, " ");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const SAGE50_CSV_HEADER = [
    "Date",
    "Reference",
    "Account",
    "Debit",
    "Credit",
    "Memo",
    "Customer",
].join(",");

export function buildSage50Csv(rows: JournalRow[]): string {
    const lines: string[] = [SAGE50_CSV_HEADER];

    for (const row of rows) {
        lines.push(
            [
                datePart(row.date),
                esc(row.referenceNumber),
                esc(row.account),
                fmt(row.debit),
                fmt(row.credit),
                esc(row.memo),
                esc(row.customer || ""),
            ].join(",")
        );
    }

    return lines.join("\r\n") + "\r\n";
}
