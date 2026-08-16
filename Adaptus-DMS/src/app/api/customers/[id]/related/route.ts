import { NextRequest, NextResponse } from "next/server";
import {
    assertOwnershipOrDeny,
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

type RelatedBucket = {
    count: number;
    items: Array<Record<string, unknown>>;
};

async function countAndSample(
    table: string,
    customerId: string,
    select: string,
    orderCol: string
): Promise<RelatedBucket> {
    const { count, error: countErr } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId);

    if (countErr) {
        if (/relation|does not exist|Could not find/i.test(countErr.message)) {
            return { count: 0, items: [] };
        }
        throw countErr;
    }

    const { data, error } = await supabaseAdmin
        .from(table)
        .select(select)
        .eq("customer_id", customerId)
        .order(orderCol, { ascending: false })
        .limit(5);

    if (error) {
        if (/relation|does not exist|Could not find/i.test(error.message)) {
            return { count: count || 0, items: [] };
        }
        throw error;
    }

    return {
        count: count || 0,
        items: ((data || []) as unknown) as Array<Record<string, unknown>>,
    };
}

/**
 * Customer 360 related activity: deals, leads, invoices, test drives, follow-ups.
 * Ownership checked on the customer row before any related reads.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const { id } = await params;

        const { data: customer, error: custErr } = await supabase
            .from("customers")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (custErr) {
            if (custErr.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw custErr;
        }

        const deny = assertOwnershipOrDeny(customer, auth.profile);
        if (deny) return deny;

        const [deals, leads, invoices, testDrives, followUps] = await Promise.all([
            countAndSample(
                "sales_deals",
                id,
                "id, status, sale_price, deal_date, created_at",
                "created_at"
            ),
            countAndSample(
                "leads",
                id,
                "id, status, source, created_at",
                "created_at"
            ),
            countAndSample(
                "invoices",
                id,
                "id, invoice_number, status, payment_amount, invoice_date, created_at",
                "created_at"
            ),
            countAndSample(
                "test_drives",
                id,
                "id, status, scheduled_at, created_at",
                "created_at"
            ),
            countAndSample(
                "follow_ups",
                id,
                "id, type, status, due_date, created_at",
                "created_at"
            ),
        ]);

        return NextResponse.json({
            data: {
                deals,
                leads,
                invoices,
                test_drives: testDrives,
                follow_ups: followUps,
            },
        });
    } catch (error: unknown) {
        console.error("Error fetching customer related activity:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
