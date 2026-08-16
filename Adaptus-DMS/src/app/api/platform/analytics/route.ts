// app/api/platform/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

// GET /api/platform/analytics - Platform-wide analytics (platform admin only)
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
        const period = url.searchParams.get("period") || "30d"; // 30d, 90d, 1y

        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        if (period === "30d") startDate.setDate(startDate.getDate() - 30);
        else if (period === "90d") startDate.setDate(startDate.getDate() - 90);
        else if (period === "1y") startDate.setFullYear(startDate.getFullYear() - 1);
        else startDate.setDate(startDate.getDate() - 30);

        // Dealership counts
        const { count: totalDealerships } = await supabase
            .from("dealerships")
            .select("*", { count: "exact", head: true });

        const { count: activeDealerships } = await supabase
            .from("dealerships")
            .select("*", { count: "exact", head: true })
            .eq("status", "Active");

        const { count: suspendedDealerships } = await supabase
            .from("dealerships")
            .select("*", { count: "exact", head: true })
            .eq("status", "Suspended");

        const { count: trialDealerships } = await supabase
            .from("dealerships")
            .select("*", { count: "exact", head: true })
            .eq("status", "Trial");

        // User counts
        const { count: totalUsers } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true });

        const { count: activeUsers } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true);

        // New signups trend (users created in period)
        const { data: newUsersTrend } = await supabase
            .from("users")
            .select("created_at")
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: true });

        // Aggregate new users by date
        const usersByDate: Record<string, number> = {};
        newUsersTrend?.forEach((u: { created_at: string }) => {
            const date = new Date(u.created_at).toISOString().split("T")[0];
            usersByDate[date] = (usersByDate[date] || 0) + 1;
        });

        // Login stats
        const { count: loginsToday } = await supabase
            .from("login_history")
            .select("*", { count: "exact", head: true })
            .eq("success", true)
            .gte("login_at", new Date().toISOString().split("T")[0]);

        const { count: loginsThisPeriod } = await supabase
            .from("login_history")
            .select("*", { count: "exact", head: true })
            .eq("success", true)
            .gte("login_at", startDate.toISOString());

        // Subscription/revenue stats
        const { data: subscriptions } = await supabase
            .from("subscriptions")
            .select("plan_name, plan_price, status");

        const revenueByPlan: Record<string, number> = {};
        let totalMonthlyRevenue = 0;
        subscriptions?.forEach((sub: { status: string; plan_name: string; plan_price?: number }) => {
            if (sub.status === "Active") {
                revenueByPlan[sub.plan_name] = (revenueByPlan[sub.plan_name] || 0) + (sub.plan_price || 0);
                totalMonthlyRevenue += sub.plan_price || 0;
            }
        });

        // Top dealerships by user count
        const { data: dealershipsWithUsers } = await supabase
            .from("dealerships")
            .select("id, name, status")
            .order("created_at", { ascending: false })
            .limit(10);

        // Rank by users then closed deals (created_at fetch is only a candidate pool)
        const topDealerships = (
            await Promise.all(
                (dealershipsWithUsers || []).map(async (d: { id: string; name: string; status: string }) => {
                    const { count: userCount } = await supabase
                        .from("users")
                        .select("*", { count: "exact", head: true })
                        .eq("dealership_id", d.id);

                    const { count: dealsCount } = await supabase
                        .from("sales_deals")
                        .select("*", { count: "exact", head: true })
                        .eq("dealership_id", d.id)
                        .eq("deal_status", "Paid Off");

                    return {
                        id: d.id,
                        name: d.name,
                        status: d.status,
                        user_count: userCount || 0,
                        deals_closed: dealsCount || 0,
                    };
                })
            )
        ).sort(
            (a, b) =>
                b.user_count - a.user_count ||
                b.deals_closed - a.deals_closed ||
                a.name.localeCompare(b.name)
        );

        // Recent audit log count by action type
        const { data: recentAuditLogs } = await supabase
            .from("audit_logs")
            .select("action")
            .gte("created_at", startDate.toISOString())
            .limit(1000);

        const actionsByType: Record<string, number> = {};
        recentAuditLogs?.forEach((log: { action: string }) => {
            const action = log.action.split(".")[0] || log.action;
            actionsByType[action] = (actionsByType[action] || 0) + 1;
        });

        return NextResponse.json({
            period,
            dealerships: {
                total: totalDealerships || 0,
                active: activeDealerships || 0,
                suspended: suspendedDealerships || 0,
                trial: trialDealerships || 0,
            },
            users: {
                total: totalUsers || 0,
                active: activeUsers || 0,
            },
            logins: {
                today: loginsToday || 0,
                this_period: loginsThisPeriod || 0,
            },
            revenue: {
                total_monthly: totalMonthlyRevenue,
                by_plan: revenueByPlan,
            },
            top_dealerships: topDealerships,
            trends: {
                new_users: usersByDate,
            },
            actions_by_type: actionsByType,
        });
    } catch (error: unknown) {
        console.error("Error fetching platform analytics:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
