// app/api/audit-logs/route.ts
// GET — dealership-scoped audit trail (read-only; mirrors the platform audit
// log pattern but filtered to the caller's dealership).
// Query params: entity_type, action (contains), from_date, to_date, limit, offset.

import { NextRequest, NextResponse } from "next/server";
import {
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const { supabase, isPlatformAdmin } = pickSupabaseClient(
            req,
            auth.profile
        );

        const url = new URL(req.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
        const entityType = url.searchParams.get("entity_type");
        const action = url.searchParams.get("action");
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");

        let query = supabase
            .from("audit_logs")
            .select(
                "id, action, entity_type, entity_id, actor_id, actor_email, actor_role, target_id, target_email, metadata, ip_address, user_agent, dealership_id, created_at",
                { count: "exact" }
            )
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        // Defense in depth on top of RLS: always scope to the caller's
        // dealership unless they are a platform admin.
        if (auth.profile.dealership_id && !isPlatformAdmin) {
            query = query.eq("dealership_id", auth.profile.dealership_id);
        }

        if (entityType) query = query.eq("entity_type", entityType);
        if (action) query = query.ilike("action", `%${action}%`);
        if (fromDate) query = query.gte("created_at", fromDate);
        if (toDate) query = query.lte("created_at", toDate);

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        console.error("Error fetching dealership audit logs:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
