// app/api/platform/audit-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

// GET /api/platform/audit-logs - List audit logs (platform admin only)
export async function GET(req: NextRequest) {
    try {
        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile || !auth.user) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;
        const user = auth.user;
        const currentUser = auth.profile;

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const action = url.searchParams.get("action");
        const entityType = url.searchParams.get("entity_type");
        const actorId = url.searchParams.get("actor_id");
        const targetId = url.searchParams.get("target_id");
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");

        let query = supabase
            .from("audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (action) query = query.ilike("action", `%${action}%`);
        if (entityType) query = query.eq("entity_type", entityType);
        if (actorId) query = query.eq("actor_id", actorId);
        if (targetId) query = query.eq("target_id", targetId);
        if (fromDate) query = query.gte("created_at", fromDate);
        if (toDate) query = query.lte("created_at", toDate);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        console.error("Error fetching audit logs:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
