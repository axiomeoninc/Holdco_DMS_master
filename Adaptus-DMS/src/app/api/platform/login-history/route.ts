// app/api/platform/login-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

// GET /api/platform/login-history - List login history (platform admin only)
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
        const userIdParam = url.searchParams.get("user_id");
        const emailParam = url.searchParams.get("email");
        const qParam = (url.searchParams.get("q") || "").trim();
        const success = url.searchParams.get("success");
        const ipAddress = url.searchParams.get("ip_address");
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");

        const UUID_RE =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        // Resolve email / free-text search → user_id and/or email ilike
        let resolvedUserId = userIdParam && UUID_RE.test(userIdParam) ? userIdParam : null;
        let emailFilter: string | null = emailParam?.trim() || null;

        const searchToken = qParam || (userIdParam && !UUID_RE.test(userIdParam) ? userIdParam : "");
        if (searchToken) {
            if (UUID_RE.test(searchToken)) {
                resolvedUserId = searchToken;
            } else if (searchToken.includes("@")) {
                emailFilter = searchToken;
            } else {
                emailFilter = searchToken;
            }
        }

        if (emailFilter && !resolvedUserId) {
            const { data: matchedUsers } = await supabase
                .from("users")
                .select("id")
                .ilike("email", `%${emailFilter}%`)
                .limit(25);
            if (matchedUsers && matchedUsers.length === 1) {
                resolvedUserId = matchedUsers[0].id;
            }
        }

        let query = supabase
            .from("login_history")
            .select("*", { count: "exact" })
            .order("login_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (resolvedUserId && emailFilter && emailFilter.includes("@")) {
            query = query.or(
                `user_id.eq.${resolvedUserId},email.ilike.%${emailFilter}%`
            );
        } else if (resolvedUserId) {
            query = query.eq("user_id", resolvedUserId);
        } else if (emailFilter) {
            query = query.ilike("email", `%${emailFilter}%`);
        }

        if (success === "true" || success === "false") {
            query = query.eq("success", success === "true");
        }
        if (ipAddress) query = query.eq("ip_address", ipAddress);
        if (fromDate) query = query.gte("login_at", fromDate);
        if (toDate) query = query.lte("login_at", toDate);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        console.error("Error fetching login history:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
