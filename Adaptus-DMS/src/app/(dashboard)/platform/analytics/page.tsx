"use client";

import { useState, useEffect, useMemo } from "react";
import {
    BarChart3,
    RefreshCw,
    DollarSign,
    Activity,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { ListPageShell } from "@/src/components/ListPageShell";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Skeleton } from "@/src/components/ui/Skeleton";
import {
    ChartContainer,
    CHART_COLORS,
    chartTooltipStyle,
    chartAxisTick,
} from "@/src/components/ui/chart";
import {
    DataTableShell,
    DataTableScroll,
    DataTable,
    DataTableHead,
    DataTableHeaderRow,
    DataTableTh,
    DataTableBody,
    DataTableRow,
    DataTableTd,
} from "@/src/components/ui/DataTable";

interface Analytics {
    period: string;
    dealerships: {
        total: number;
        active: number;
        suspended: number;
        trial: number;
    };
    users: {
        total: number;
        active: number;
    };
    logins: {
        today: number;
        this_period: number;
    };
    revenue: {
        total_monthly: number;
        by_plan: Record<string, number>;
    };
    top_dealerships: Array<{
        id: string;
        name: string;
        status: string;
        user_count: number;
        deals_closed: number;
    }>;
    trends: {
        new_users: Record<string, number>;
    };
    actions_by_type: Record<string, number>;
}

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState("30d");

    useEffect(() => {
        void fetchAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when period changes
    }, [period]);

    async function fetchAnalytics() {
        try {
            setLoading(true);
            setError(null);

            const meResponse = await fetch("/api/me", {});
            if (!meResponse.ok) throw new Error("Failed to get user info");
            const meData = await meResponse.json();
            if (!meData.data?.is_platform_admin) {
                setError("You do not have permission to access platform analytics");
                return;
            }

            const response = await fetch(`/api/platform/analytics?period=${period}`, {});
            if (!response.ok) throw new Error("Failed to fetch analytics");

            const data = await response.json();
            setAnalytics(data);
        } catch (err: unknown) {
            console.error("Error fetching analytics:", err);
            setError(err instanceof Error ? err.message : "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    }

    const planChartData = useMemo(() => {
        if (!analytics) return [];
        return Object.entries(analytics.revenue.by_plan).map(([name, value]) => ({
            name,
            value,
        }));
    }, [analytics]);

    const activityChartData = useMemo(() => {
        if (!analytics) return [];
        return Object.entries(analytics.actions_by_type)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }));
    }, [analytics]);

    if (error && !analytics && !loading) {
        return (
            <ListPageShell
                title="Analytics"
                description="Platform metrics and performance insights"
                icon={BarChart3}
                breadcrumbs={[
                    { label: "AdaptUs Platform", href: "/dashboard" },
                    { label: "Analytics" },
                ]}
            >
                <EmptyState
                    kind="permission"
                    title="Access denied"
                    description={error}
                />
            </ListPageShell>
        );
    }

    return (
        <ListPageShell
            title="Analytics"
            description="Platform metrics and performance insights"
            icon={BarChart3}
            breadcrumbs={[
                { label: "AdaptUs Platform", href: "/dashboard" },
                { label: "Analytics" },
            ]}
            actions={
                <div className="flex items-center gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Analytics period"
                    >
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="1y">Last Year</option>
                    </select>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchAnalytics()}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading && !analytics}
                    items={[
                        {
                            label: "Dealerships",
                            value: analytics?.dealerships.total ?? 0,
                            format: "number",
                            hint: analytics
                                ? `${analytics.dealerships.active} active · ${analytics.dealerships.trial} trial`
                                : undefined,
                        },
                        {
                            label: "Users",
                            value: analytics?.users.total ?? 0,
                            format: "number",
                            hint: analytics ? `${analytics.users.active} active` : undefined,
                            tone: "success",
                        },
                        {
                            label: "Logins",
                            value: analytics?.logins.this_period ?? 0,
                            format: "number",
                            hint: analytics ? `${analytics.logins.today} today` : undefined,
                        },
                        {
                            label: "MRR",
                            value: analytics?.revenue.total_monthly ?? 0,
                            format: "currency",
                        },
                    ]}
                />
            }
        >
            {error && analytics ? (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {loading && !analytics ? (
                <Skeleton className="h-64 rounded-lg" />
            ) : analytics ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-semibold text-foreground">
                                    Revenue by plan
                                </h2>
                            </div>
                            {planChartData.length === 0 ? (
                                <EmptyState
                                    kind="no-results"
                                    title="No plan revenue"
                                    description="Active subscriptions with pricing will appear here."
                                    className="py-10"
                                />
                            ) : (
                                <ChartContainer height={240}>
                                    <BarChart data={planChartData}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="hsl(var(--border))"
                                        />
                                        <XAxis
                                            dataKey="name"
                                            tick={chartAxisTick}
                                            stroke="hsl(var(--border))"
                                        />
                                        <YAxis
                                            tick={chartAxisTick}
                                            stroke="hsl(var(--border))"
                                        />
                                        <Tooltip
                                            contentStyle={chartTooltipStyle}
                                            formatter={(value) =>
                                                new Intl.NumberFormat("en-US", {
                                                    style: "currency",
                                                    currency: "USD",
                                                    maximumFractionDigits: 0,
                                                }).format(Number(value ?? 0))
                                            }
                                        />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {planChartData.map((_, idx) => (
                                                <Cell
                                                    key={idx}
                                                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </div>

                        <div className="rounded-lg border border-border bg-card p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-semibold text-foreground">
                                    Activity by type
                                </h2>
                            </div>
                            {activityChartData.length === 0 ? (
                                <EmptyState
                                    kind="no-results"
                                    title="No activity yet"
                                    description="Audit actions in this period will show here."
                                    className="py-10"
                                />
                            ) : (
                                <ChartContainer height={240}>
                                    <BarChart data={activityChartData} layout="vertical">
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            horizontal
                                            vertical={false}
                                            stroke="hsl(var(--border))"
                                        />
                                        <XAxis
                                            type="number"
                                            tick={chartAxisTick}
                                            stroke="hsl(var(--border))"
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={80}
                                            tick={chartAxisTick}
                                            stroke="hsl(var(--border))"
                                        />
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {activityChartData.map((_, idx) => (
                                                <Cell
                                                    key={idx}
                                                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </div>
                    </div>

                    <div>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Top dealerships
                        </h2>
                        {analytics.top_dealerships.length === 0 ? (
                            <EmptyState
                                kind="no-results"
                                title="No dealerships"
                                description="Dealership rankings by users and closed deals will appear here."
                            />
                        ) : (
                            <DataTableShell>
                                <DataTableScroll>
                                    <DataTable>
                                        <DataTableHead>
                                            <DataTableHeaderRow>
                                                <DataTableTh>Dealership</DataTableTh>
                                                <DataTableTh>Status</DataTableTh>
                                                <DataTableTh>Users</DataTableTh>
                                                <DataTableTh>Deals closed</DataTableTh>
                                            </DataTableHeaderRow>
                                        </DataTableHead>
                                        <DataTableBody>
                                            {analytics.top_dealerships.map((d) => (
                                                <DataTableRow key={d.id}>
                                                    <DataTableTd>
                                                        <p className="font-medium text-foreground">
                                                            {d.name}
                                                        </p>
                                                    </DataTableTd>
                                                    <DataTableTd>
                                                        <StatusBadge status={d.status} />
                                                    </DataTableTd>
                                                    <DataTableTd>
                                                        <span className="tabular-nums">
                                                            {d.user_count}
                                                        </span>
                                                    </DataTableTd>
                                                    <DataTableTd>
                                                        <span className="tabular-nums">
                                                            {d.deals_closed}
                                                        </span>
                                                    </DataTableTd>
                                                </DataTableRow>
                                            ))}
                                        </DataTableBody>
                                    </DataTable>
                                </DataTableScroll>
                            </DataTableShell>
                        )}
                    </div>
                </div>
            ) : (
                <EmptyState
                    kind="first-use"
                    title="No analytics yet"
                    description="Platform metrics will appear once dealerships and users are active."
                    action={{
                        label: "Refresh",
                        onClick: () => void fetchAnalytics(),
                        icon: RefreshCw,
                    }}
                />
            )}
        </ListPageShell>
    );
}
