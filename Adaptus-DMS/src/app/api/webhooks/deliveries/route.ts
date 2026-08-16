import { NextRequest, NextResponse } from "next/server";
import {
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";

/**
 * Webhook delivery log for a dealership (latest first).
 * Query params: limit, offset, event, status.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const url = new URL(req.url);
        const limit = Math.min(
            Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
            200
        );
        const offset = Math.max(
            parseInt(url.searchParams.get("offset") || "0", 10) || 0,
            0
        );
        const event = url.searchParams.get("event");
        const status = url.searchParams.get("status");

        let query = supabase
            .from("webhook_deliveries")
            .select("*", { count: "exact" })
            .eq("dealership_id", auth.dealership_id)
            .order("attempted_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (event) query = query.eq("event", event);
        if (status === "sent" || status === "failed" || status === "skipped") {
            query = query.eq("status", status);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Webhook deliveries error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
