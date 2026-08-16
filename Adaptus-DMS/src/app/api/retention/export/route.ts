// app/api/retention/export/route.ts
// POST — generate the 10-year full-dealership data export (portable JSON
// bundle). Records the export in retention_exports and the audit trail.
//
// Retention policy: FlashFender retains dealership records for 10 years; this
// export is the dealer's portable copy of their data ("Your data, always").

import { NextRequest, NextResponse } from "next/server";
import {
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { canExport } from "@/src/lib/permission-middleware";
import {
    buildRetentionExportJson,
    retentionFileName,
    rowCounts,
    type RetentionExportBundle,
} from "@/src/lib/audit";
import { logAudit } from "@/src/lib/audit";

type Supabase = ReturnType<typeof pickSupabaseClient>["supabase"];

const RETENTION_TABLES = [
    "vehicles",
    "customers",
    "sales_deals",
    "invoices",
    "quotations",
    "bill_of_sale",
    "bill_of_sale_payments",
    "expenses",
    "purchase_from_public",
    "financial_transactions",
    "leads",
    "audit_logs",
    "esign_signatures",
    "payment_records",
    "retention_exports",
] as const;

async function collectTable(
    supabase: Supabase,
    table: string,
    dealershipId: string | null,
    isPlatformAdmin: boolean
): Promise<unknown[]> {
    let q = supabase.from(table).select("*").limit(100000);
    if (dealershipId && !isPlatformAdmin) {
        q = q.eq("dealership_id", dealershipId);
    } else if (isPlatformAdmin && dealershipId) {
        q = q.eq("dealership_id", dealershipId);
    }
    const { data, error } = await q;
    if (error) {
        console.warn(`[retention] skipped table ${table}:`, error.message);
        return [];
    }
    return (data || []) as unknown[];
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        if (
            !canExport(auth.profile.role, auth.profile.user_permissions || [], "reports")
        ) {
            return NextResponse.json(
                { error: "Forbidden - Managers and admins can request retention exports" },
                { status: 403 }
            );
        }

        const { supabase, isPlatformAdmin } = pickSupabaseClient(req, auth.profile);
        const dealershipId = auth.profile.dealership_id;

        const dealership = dealershipId
            ? await collectTable(supabase, "dealerships", dealershipId, true)
            : [];

        const entries = await Promise.all(
            RETENTION_TABLES.map(async (table) => [
                table,
                await collectTable(supabase, table, dealershipId, isPlatformAdmin),
            ] as const)
        );

        const tables: Record<string, unknown[]> = {
            dealerships: dealership,
        };
        for (const [table, rows] of entries) {
            tables[table] = rows;
        }

        const bundle: RetentionExportBundle = {
            format: "flashfender-retention-export",
            formatVersion: 1,
            generated_at: new Date().toISOString(),
            dealership: {
                id: dealershipId,
                name: (dealership[0] as { name?: string } | undefined)?.name || null,
            },
            exported_by: {
                id: auth.profile.id,
                email: auth.profile.email,
                role: auth.profile.role,
            },
            retentionYears: 10,
            tables,
        };

        const counts = rowCounts(tables);
        const json = buildRetentionExportJson(bundle);
        const bytes = Buffer.byteLength(json, "utf8");
        const fileName = retentionFileName(bundle.dealership.name);

        // Record the archive in retention_exports (auditable history).
        const { error: recordErr } = await supabase
            .from("retention_exports")
            .insert({
                dealership_id: dealershipId,
                requested_by: auth.profile.id,
                archive_type: "full",
                status: "completed",
                file_name: fileName,
                file_size_bytes: bytes,
                row_counts: counts,
            });
        if (recordErr) {
            console.warn("[retention] could not record export:", recordErr.message);
        }

        await logAudit(supabase, {
            action: "retention.export",
            entity_type: "retention_export",
            actor_id: auth.profile.id,
            actor_email: auth.profile.email,
            actor_role: auth.profile.role,
            dealership_id: dealershipId,
            metadata: { file_name: fileName, row_counts: counts, bytes },
        });

        return new NextResponse(json, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
                "X-Retention-Row-Count": String(
                    Object.values(counts).reduce((a, b) => a + b, 0)
                ),
            },
        });
    } catch (error: unknown) {
        console.error("Retention export error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/** GET — recent retention export history for the dealership. */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const { supabase, isPlatformAdmin } = pickSupabaseClient(req, auth.profile);
        let q = supabase
            .from("retention_exports")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);
        if (auth.profile.dealership_id && !isPlatformAdmin) {
            q = q.eq("dealership_id", auth.profile.dealership_id);
        }
        const { data, error } = await q;
        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (error: unknown) {
        console.error("Retention export history error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
