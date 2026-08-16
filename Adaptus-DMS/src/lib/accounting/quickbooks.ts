/**
 * QuickBooks export: Intuit Interchange Format (IIF) general journal entries.
 *
 * IIF structure for journal entries:
 *   !TRNS row (header / first line), then one !SPL row per split leg.
 * Debit/credit direction is carried by the sign of the AMOUNT field
 * (positive = debit on the SPL line, negative = credit).
 */

import type { JournalRow } from "./types";

function fmt(n: number): string {
    return n.toFixed(2);
}

function datePart(date: string): string {
    return date.includes("T") ? date.split("T")[0]! : date;
}

/** Escape IIF field separators (tabs) and control chars. */
function esc(value: unknown): string {
    return String(value ?? "")
        .replace(/\t/g, " ")
        .replace(/[\r\n]+/g, " ")
        .trim();
}

export function buildQuickbooksIif(rows: JournalRow[]): string {
    const lines: string[] = [
        "!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tCLEAR",
        "!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tCLEAR",
    ];

    // Group by reference number (each source doc = one journal entry).
    const groups = new Map<string, JournalRow[]>();
    for (const row of rows) {
        const list = groups.get(row.referenceNumber) || [];
        list.push(row);
        groups.set(row.referenceNumber, list);
    }

    let entryIndex = 1;
    for (const [ref, legs] of groups) {
        const first = legs[0]!;
        const date = datePart(first.date);
        const memo = esc(first.memo);
        const name = esc(first.customer);

        // TRNS header — first leg's debit amount as the total.
        lines.push(
            [
                "TRNS",
                entryIndex,
                "GENERAL JOURNAL",
                date,
                esc(first.account),
                name,
                fmt(legs[0]!.debit || -legs[0]!.credit),
                esc(ref),
                memo,
                "N",
            ].join("\t")
        );

        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i]!;
            const amount = leg.debit > 0 ? leg.debit : -leg.credit;
            lines.push(
                [
                    "SPL",
                    `${entryIndex}-${i + 1}`,
                    "GENERAL JOURNAL",
                    date,
                    esc(leg.account),
                    esc(leg.customer),
                    fmt(amount),
                    esc(ref),
                    memo,
                    "N",
                ].join("\t")
            );
        }
        entryIndex += 1;
    }

    return lines.join("\r\n") + "\r\n";
}
