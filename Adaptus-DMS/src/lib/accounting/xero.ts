/**
 * Xero export: journal CSV for Xero's Journal Entries CSV import.
 *
 * Column layout follows Xero's journal import template:
 *   JournalDate, JournalNumber, JournalLineNumber, AccountCode, AccountName,
 *   Narrative, NetAmount, TaxAmount, GrossAmount
 *
 * GrossAmount carries the signed line total (positive debit / negative credit),
 * which is what Xero uses to balance the journal.
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

export const XERO_JOURNAL_CSV_HEADER = [
    "JournalDate",
    "JournalNumber",
    "JournalLineNumber",
    "AccountCode",
    "AccountName",
    "Narrative",
    "NetAmount",
    "TaxAmount",
    "GrossAmount",
].join(",");

export function buildXeroJournalCsv(rows: JournalRow[]): string {
    const lines: string[] = [XERO_JOURNAL_CSV_HEADER];

    // One journal per source document (reference number).
    const groups = new Map<string, JournalRow[]>();
    for (const row of rows) {
        const list = groups.get(row.referenceNumber) || [];
        list.push(row);
        groups.set(row.referenceNumber, list);
    }

    for (const [ref, legs] of groups) {
        const date = datePart(legs[0]!.date);
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i]!;
            const gross = leg.debit > 0 ? leg.debit : -leg.credit;
            const narrative = leg.customer
                ? `${leg.memo} (${leg.customer})`
                : leg.memo;
            lines.push(
                [
                    date,
                    esc(ref),
                    String(i + 1),
                    esc(leg.accountCode || ""),
                    esc(leg.account),
                    esc(narrative),
                    "0.00", // net (before tax) — we export gross lines; tax handled by accountant
                    "0.00",
                    fmt(gross),
                ].join(",")
            );
        }
    }

    return lines.join("\r\n") + "\r\n";
}
