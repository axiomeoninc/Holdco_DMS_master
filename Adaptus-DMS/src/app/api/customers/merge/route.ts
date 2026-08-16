import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const CUSTOMER_FK_TABLES = [
    { table: "sales_deals", column: "customer_id" },
    { table: "invoices", column: "customer_id" },
    { table: "leads", column: "customer_id" },
    { table: "test_drives", column: "customer_id" },
    { table: "follow_ups", column: "customer_id" },
    { table: "quotations", column: "customer_id" },
    { table: "ocr_documents", column: "customer_id" },
    { table: "finance_calculations", column: "customer_id" },
    { table: "bill_of_sale", column: "customer_id" },
    { table: "email_sequence_enrollments", column: "customer_id" },
] as const;

/**
 * Merge duplicate customer into keep customer.
 * Reassigns FK refs, soft-deletes duplicate (status=Inactive + merge note).
 * Does not hard-delete so history remains recoverable.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json();
        const keepId = body.keep_id as string | undefined;
        const mergeId = body.merge_id as string | undefined;

        if (!keepId || !mergeId) {
            return NextResponse.json(
                { error: "keep_id and merge_id are required" },
                { status: 400 }
            );
        }
        if (keepId === mergeId) {
            return NextResponse.json(
                { error: "Cannot merge a customer into itself" },
                { status: 400 }
            );
        }

        const { data: rows, error: fetchError } = await supabaseAdmin
            .from("customers")
            .select("*")
            .in("id", [keepId, mergeId]);

        if (fetchError) throw fetchError;
        if (!rows || rows.length !== 2) {
            return NextResponse.json({ error: "One or both customers not found" }, { status: 404 });
        }

        const keep = rows.find((r) => r.id === keepId)!;
        const merge = rows.find((r) => r.id === mergeId)!;

        if (!auth.profile.is_platform_admin) {
            if (keep.dealership_id !== dealershipId || merge.dealership_id !== dealershipId) {
                return NextResponse.json({ error: "Customers must belong to your dealership" }, { status: 403 });
            }
        } else if (keep.dealership_id !== merge.dealership_id) {
            return NextResponse.json(
                { error: "Cannot merge customers across dealerships" },
                { status: 400 }
            );
        }

        const reassigned: Record<string, number> = {};

        for (const { table, column } of CUSTOMER_FK_TABLES) {
            const { data: updated, error } = await supabaseAdmin
                .from(table)
                .update({ [column]: keepId })
                .eq(column, mergeId)
                .select("id");

            if (error) {
                // Table may not exist in all environments — skip quietly
                if (/relation|does not exist|Could not find/i.test(error.message)) {
                    reassigned[table] = 0;
                    continue;
                }
                throw error;
            }
            reassigned[table] = updated?.length || 0;
        }

        // Fill empty fields on keep from merge when keep is blank
        const fill: Record<string, unknown> = {};
        for (const field of ["email", "phone", "address", "city", "province", "postal_code", "source"] as const) {
            if (!keep[field] && merge[field]) {
                fill[field] = merge[field];
            }
        }

        // CASL: never lose a true consent on merge. Prefer earliest consent_at.
        const stamp = new Date().toISOString();
        if (merge.marketing_consent && !keep.marketing_consent) {
            fill.marketing_consent = true;
            fill.marketing_consent_at = merge.marketing_consent_at || stamp;
            if (merge.marketing_consent_ip) fill.marketing_consent_ip = merge.marketing_consent_ip;
        } else if (
            merge.marketing_consent &&
            keep.marketing_consent &&
            merge.marketing_consent_at &&
            keep.marketing_consent_at &&
            String(merge.marketing_consent_at) < String(keep.marketing_consent_at)
        ) {
            fill.marketing_consent_at = merge.marketing_consent_at;
        }
        if (merge.sms_consent && !keep.sms_consent) {
            fill.sms_consent = true;
            fill.sms_consent_at = merge.sms_consent_at || stamp;
            if (merge.sms_consent_ip) fill.sms_consent_ip = merge.sms_consent_ip;
        } else if (
            merge.sms_consent &&
            keep.sms_consent &&
            merge.sms_consent_at &&
            keep.sms_consent_at &&
            String(merge.sms_consent_at) < String(keep.sms_consent_at)
        ) {
            fill.sms_consent_at = merge.sms_consent_at;
        }

        const keepNotes = [
            keep.notes,
            `Merged duplicate ${mergeId} (${merge.name}) on ${stamp.slice(0, 10)}.`,
        ]
            .filter(Boolean)
            .join("\n");

        let keptUpdated;
        let keepErr;
        {
            const result = await supabaseAdmin
                .from("customers")
                .update({
                    ...fill,
                    notes: keepNotes,
                    updated_at: stamp,
                })
                .eq("id", keepId)
                .select()
                .single();
            keptUpdated = result.data;
            keepErr = result.error;
            if (keepErr && /marketing_consent_ip|sms_consent_ip|column/i.test(keepErr.message || "")) {
                const {
                    marketing_consent_ip: _m,
                    sms_consent_ip: _s,
                    ...withoutIp
                } = fill;
                const retry = await supabaseAdmin
                    .from("customers")
                    .update({
                        ...withoutIp,
                        notes: keepNotes,
                        updated_at: stamp,
                    })
                    .eq("id", keepId)
                    .select()
                    .single();
                keptUpdated = retry.data;
                keepErr = retry.error;
            }
        }

        if (keepErr) throw keepErr;

        const mergeNotes = [
            merge.notes,
            `SOFT-DELETED via merge into ${keepId} (${keep.name}) on ${stamp}.`,
        ]
            .filter(Boolean)
            .join("\n");

        const { data: mergedUpdated, error: mergeErr } = await supabaseAdmin
            .from("customers")
            .update({
                status: "Inactive",
                notes: mergeNotes,
                email: merge.email
                    ? `merged+${merge.id.slice(0, 8)}@${String(merge.email).includes("@") ? String(merge.email).split("@")[1] : "merged.local"}`
                    : null,
                updated_at: stamp,
            })
            .eq("id", mergeId)
            .select()
            .single();

        if (mergeErr) throw mergeErr;

        return NextResponse.json({
            data: {
                keep: keptUpdated,
                merged: mergedUpdated,
                reassigned,
            },
            message: "Customers merged. Duplicate marked Inactive; deals and comms preserved on keep record.",
        });
    } catch (error: unknown) {
        console.error("Error merging customers:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
