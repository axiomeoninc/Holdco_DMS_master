/**
 * Retention export builders — 10-year full dealership data export.
 *
 * The export is a versioned JSON bundle (one file per dealership) plus CSV
 * variants for the core ledgers. Retention policy note: FlashFender keeps
 * dealership records for 10 years; this export is the dealer's portable copy.
 */

export interface RetentionExportBundle {
    format: "flashfender-retention-export";
    formatVersion: 1;
    generated_at: string;
    dealership: { id: string | null; name: string | null };
    exported_by: { id: string | null; email: string | null; role: string | null };
    retentionYears: 10;
    tables: Record<string, unknown[]>;
}

export function rowCounts(tables: Record<string, unknown[]>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [name, rows] of Object.entries(tables)) {
        counts[name] = Array.isArray(rows) ? rows.length : 0;
    }
    return counts;
}

export function buildRetentionExportJson(bundle: RetentionExportBundle): string {
    return JSON.stringify(bundle, null, 2);
}

/** Sanitized, timestamped file name for a dealership retention export. */
export function retentionFileName(dealershipName: string | null): string {
    const slug =
        (dealershipName || "dealership")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "dealership";
    const stamp = new Date().toISOString().split("T")[0] ?? "export";
    return `flashfender-${slug}-retention-${stamp}.json`;
}

function csvEsc(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Generic CSV serializer for a table of row objects. Column order follows the
 * first row's keys; later rows that lack a key emit an empty cell.
 */
export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return "";
    const keys = Object.keys(rows[0]!);
    const header = keys.map(csvEsc).join(",");
    const body = rows.map((row) =>
        keys.map((k) => csvEsc(row[k])).join(",")
    );
    return [header, ...body].join("\r\n") + "\r\n";
}

/** Stable CSV bundle: table name → CSV string for non-empty tables. */
export function rowsToCsvBundle(tables: Record<string, unknown[]>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, rows] of Object.entries(tables)) {
        const safe = rows.map((r) => r as Record<string, unknown>);
        if (safe.length > 0) out[name] = rowsToCsv(safe);
    }
    return out;
}
