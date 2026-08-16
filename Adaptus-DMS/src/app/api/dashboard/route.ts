import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
    type TenantScopeOpts,
} from "@/src/lib/tenant-scope";

function calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

function getStartOfPeriod(period: "month" | "quarter" | "year"): string {
    const now = new Date();
    if (period === "month") {
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (period === "quarter") {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString();
    } else {
        return new Date(now.getFullYear(), 0, 1).toISOString();
    }
}

function getStartOfPreviousPeriod(period: "month" | "quarter" | "year"): string {
    const now = new Date();
    if (period === "month") {
        return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    } else if (period === "quarter") {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        if (currentQuarter === 0) {
            return new Date(now.getFullYear() - 1, 9, 1).toISOString();
        }
        return new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1).toISOString();
    } else {
        return new Date(now.getFullYear() - 1, 0, 1).toISOString();
    }
}

function emptyDealerTiles() {
    return {
        stats: {
            totalVehicles: 0,
            totalCustomers: 0,
            totalLeads: 0,
            totalSales: 0,
            totalInvoices: 0,
            activeVehicles: 0,
            pendingInvoices: 0,
            totalRevenue: 0,
        },
        changes: {
            vehicles: 0,
            customers: 0,
            leads: 0,
            sales: 0,
            invoices: 0,
            activeVehicles: 0,
        },
        kpis: {
            completionRate: 0,
            revenueGrowth: 0,
            activeUsers: 0,
            avgResponseHours: 0,
        },
    };
}

export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const currentUser = auth.profile;
        const scope = tenantScopeFromRequest(tenant, req);

        if (!currentUser.is_platform_admin && !currentUser.dealership_id) {
            return NextResponse.json(
                { error: "Unauthorized - No dealership context" },
                { status: 403 }
            );
        }

        // Platform without a rooftop: AdaptUs aggregates, never mixed salesperson names.
        if (scope.isPlatformAdmin && !scope.platformDealershipId) {
            const [dealershipsResult, usersResult] = await Promise.all([
                scopedTable(supabase, "dealerships", scope).select("*", {
                    count: "exact",
                    head: true,
                }),
                scopedTable(supabase, "users", scope).select("*", {
                    count: "exact",
                    head: true,
                }).eq("is_active", true),
            ]);

            const tiles = emptyDealerTiles();
            tiles.kpis.activeUsers = usersResult.count || 0;
            return NextResponse.json({
                ...tiles,
                stats: {
                    ...tiles.stats,
                    dealerships: dealershipsResult.count || 0,
                },
                recentSales: [],
                recentLeads: [],
            });
        }

        const rooftopScope: TenantScopeOpts = {
            ...scope,
            platformDealershipId: scope.isPlatformAdmin
                ? requireWriteDealershipId(scope)
                : scope.platformDealershipId,
        };

        const monthStart = getStartOfPeriod("month");
        const previousMonthStart = getStartOfPreviousPeriod("month");
        const quarterStart = getStartOfPeriod("quarter");
        const previousQuarterStart = getStartOfPreviousPeriod("quarter");

        const [
            vehiclesResult,
            customersResult,
            leadsResult,
            salesResult,
            invoicesResult,
            activeVehiclesResult,
            pendingInvoicesResult,
            prevVehiclesResult,
            prevCustomersResult,
            prevLeadsResult,
            prevSalesResult,
            prevInvoicesResult,
            prevActiveVehiclesResult,
            closedDealsResult,
            totalDealsResult,
            usersResult,
            leadsWithEngagementResult,
        ] = await Promise.all([
            scopedTable(supabase, "vehicles", rooftopScope).select("*", { count: "exact", head: true }),
            scopedTable(supabase, "customers", rooftopScope).select("*", { count: "exact", head: true }),
            scopedTable(supabase, "leads", rooftopScope).select("*", { count: "exact", head: true }),
            scopedTable(supabase, "sales_deals", rooftopScope).select("*", { count: "exact", head: true }),
            scopedTable(supabase, "invoices", rooftopScope).select("*", { count: "exact", head: true }),
            scopedTable(supabase, "vehicles", rooftopScope).select("*", { count: "exact", head: true }).eq("status", "Active"),
            scopedTable(supabase, "invoices", rooftopScope).select("*", { count: "exact", head: true }).eq("status", "Pending"),
            scopedTable(supabase, "vehicles", rooftopScope).select("*", { count: "exact", head: true }).gte("created_at", previousMonthStart).lt("created_at", monthStart),
            scopedTable(supabase, "customers", rooftopScope).select("*", { count: "exact", head: true }).gte("created_at", previousMonthStart).lt("created_at", monthStart),
            scopedTable(supabase, "leads", rooftopScope).select("*", { count: "exact", head: true }).gte("created_at", previousMonthStart).lt("created_at", monthStart),
            scopedTable(supabase, "sales_deals", rooftopScope).select("*", { count: "exact", head: true }).gte("created_at", previousMonthStart).lt("created_at", monthStart),
            scopedTable(supabase, "invoices", rooftopScope).select("*", { count: "exact", head: true }).gte("created_at", previousMonthStart).lt("created_at", monthStart),
            scopedTable(supabase, "vehicles", rooftopScope).select("*", { count: "exact", head: true }).eq("status", "Active").gte("created_at", previousMonthStart).lt("created_at", monthStart),
            scopedTable(supabase, "sales_deals", rooftopScope).select("*", { count: "exact", head: true }).eq("deal_status", "Closed"),
            scopedTable(supabase, "sales_deals", rooftopScope).select("*", { count: "exact", head: true }),
            scopedTable(supabase, "users", rooftopScope).select("*", { count: "exact", head: true }).eq("is_active", true),
            scopedTable(supabase, "leads", rooftopScope).select("lead_creation_date, last_engagement").not("last_engagement", "is", null),
        ]);

        const totalVehicles = vehiclesResult.count || 0;
        const totalCustomers = customersResult.count || 0;
        const totalLeads = leadsResult.count || 0;
        const totalSales = salesResult.count || 0;
        const totalInvoices = invoicesResult.count || 0;
        const activeVehicles = activeVehiclesResult.count || 0;
        const pendingInvoices = pendingInvoicesResult.count || 0;

        const prevVehicles = prevVehiclesResult.count || 0;
        const prevCustomers = prevCustomersResult.count || 0;
        const prevLeads = prevLeadsResult.count || 0;
        const prevSales = prevSalesResult.count || 0;
        const prevInvoices = prevInvoicesResult.count || 0;
        const prevActiveVehicles = prevActiveVehiclesResult.count || 0;

        const closedDeals = closedDealsResult.count || 0;
        const totalDeals = totalDealsResult.count || 0;
        const activeUsers = usersResult.count || 0;

        const completionRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0;

        const { data: currentQuarterSales } = await scopedTable(supabase, "sales_deals", rooftopScope)
            .select("sale_price")
            .gte("created_at", quarterStart)
            .eq("deal_status", "Closed");

        const { data: previousQuarterSales } = await scopedTable(supabase, "sales_deals", rooftopScope)
            .select("sale_price")
            .gte("created_at", previousQuarterStart)
            .lt("created_at", quarterStart)
            .eq("deal_status", "Closed");

        const currentRevenue = currentQuarterSales?.reduce((sum: number, deal: { sale_price?: number }) => sum + (deal.sale_price || 0), 0) || 0;
        const previousRevenue = previousQuarterSales?.reduce((sum: number, deal: { sale_price?: number }) => sum + (deal.sale_price || 0), 0) || 0;
        const revenueGrowth = previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : (currentRevenue > 0 ? 100 : 0);

        let avgResponseHours = 0;
        const leadsWithEngagement = leadsWithEngagementResult?.data || [];
        if (leadsWithEngagement.length > 0) {
            const totalResponseTime = leadsWithEngagement.reduce((sum: number, lead: { lead_creation_date?: string; last_engagement?: string }) => {
                if (lead.lead_creation_date && lead.last_engagement) {
                    const created = new Date(lead.lead_creation_date).getTime();
                    const engaged = new Date(lead.last_engagement).getTime();
                    return sum + (engaged - created);
                }
                return sum;
            }, 0);
            const avgResponseMs = totalResponseTime / leadsWithEngagement.length;
            avgResponseHours = Math.round((avgResponseMs / (1000 * 60 * 60)) * 10) / 10;
        }

        const { data: allDeals } = await scopedTable(supabaseAdmin, "sales_deals", rooftopScope)
            .select("sale_price");
        const totalRevenue = (allDeals || []).reduce((sum: number, deal: { sale_price?: number }) => sum + (deal.sale_price || 0), 0);

        const { data: recentSales, error: salesError } = await scopedTable(supabase, "sales_deals", rooftopScope)
            .select(`
                *,
                vehicle:vehicles(make, model, year),
                customer:customers(name),
                salesperson:users(full_name)
            `)
            .order("created_at", { ascending: false })
            .limit(5);

        if (salesError) {
            console.error("Error fetching recent sales:", salesError);
        }

        const { data: recentLeads, error: leadsError } = await scopedTable(supabase, "leads", rooftopScope)
            .select(`
                *,
                customer:customers(name),
                assigned_user:users(full_name)
            `)
            .order("created_at", { ascending: false })
            .limit(5);

        if (leadsError) {
            console.error("Error fetching recent leads:", leadsError);
        }

        return NextResponse.json({
            stats: {
                totalVehicles,
                totalCustomers,
                totalLeads,
                totalSales,
                totalInvoices,
                activeVehicles,
                pendingInvoices,
                totalRevenue,
            },
            changes: {
                vehicles: calculatePercentageChange(totalVehicles, prevVehicles),
                customers: calculatePercentageChange(totalCustomers, prevCustomers),
                leads: calculatePercentageChange(totalLeads, prevLeads),
                sales: calculatePercentageChange(totalSales, prevSales),
                invoices: calculatePercentageChange(totalInvoices, prevInvoices),
                activeVehicles: calculatePercentageChange(activeVehicles, prevActiveVehicles),
            },
            kpis: {
                completionRate,
                revenueGrowth,
                activeUsers,
                avgResponseHours,
            },
            recentSales: recentSales || [],
            recentLeads: recentLeads || [],
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Dashboard API Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
