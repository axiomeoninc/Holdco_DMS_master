"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { CHART_COLORS, chartTooltipStyle } from "@/src/components/ui/chart";
import {
    User,
    DollarSign,
    FileText,
    Clock,
    ArrowUpRight,
    Calendar,
    Package,
    Briefcase,
    Target,
    Inbox,
    Flame,
    Plus,
    Phone,
    LayoutDashboard,
    type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Avatar } from "@/src/components/ui/Avatar";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { DeskBriefWidget } from "@/src/components/ai/DeskBriefWidget";
import { Button } from "@/src/components/ui/Button";
import { cn, formatCurrency, timeAgo } from "@/src/lib/utils";

// ── Types ────────────────────────────────────────────────────────────
interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    dealership_id: string;
    is_platform_admin: boolean;
}
interface DashboardStats {
    totalVehicles: number;
    totalCustomers: number;
    totalLeads: number;
    totalSales: number;
    totalInvoices: number;
    activeVehicles: number;
    pendingInvoices: number;
    /** Sum of sale_price across all deals — real revenue, unlike totalSales (a count). */
    totalRevenue?: number;
}
interface RecentSale {
    id: string;
    sale_price: number;
    deal_date: string;
    deal_status: string;
    vehicle?: { make?: string; year?: number; model?: string };
    customer?: { name?: string; avatar?: string | null };
    salesperson?: { full_name?: string; avatar?: string | null };
}
interface RecentLead {
    id: string;
    source: string;
    status: string;
    lead_creation_date: string;
    customer?: { name?: string; avatar?: string | null };
    assigned_user?: { full_name?: string; avatar?: string | null };
    notes?: string;
}
interface DashboardData {
    stats: DashboardStats;
    changes: { vehicles: number; customers: number; leads: number; sales: number; invoices: number; activeVehicles: number };
    recentSales: RecentSale[];
    recentLeads: RecentLead[];
}
interface ChartData { name: string; value: number }

interface DashboardFollowUp {
    id: string;
    subject?: string | null;
    status?: string | null;
    follow_up_date?: string | null;
    priority?: string | null;
    customer?: { name?: string } | null;
}

interface DashboardTask {
    id: string;
    title?: string | null;
    description?: string | null;
    due_date?: string | null;
    status?: string | null;
}

interface DashboardVehicle {
    id?: string;
    status?: string | null;
    created_at?: string | null;
    vin?: string | null;
    year?: string | number | null;
    make?: string | null;
    model?: string | null;
    retail_price?: number | null;
}

interface DashboardExpense {
    id?: string;
    category?: string | null;
}

interface DashboardAnalytics {
    dealerships?: { total?: number };
    users?: { total?: number };
}

// ── Today item ───────────────────────────────────────────────────────
function TodayItem({
    icon: Icon,
    tint,
    label,
    value,
    href,
}: {
    icon: LucideIcon;
    tint: string;
    label: string;
    value: string | number;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card/80 p-3 transition-all hover:border-primary/40 hover:bg-card hover:shadow-sm"
        >
            <div className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tint)}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
                <p className="truncate text-h4 text-foreground">{value}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
    );
}

// ── Stat card config ─────────────────────────────────────────────────
function buildStatCards(stats: DashboardStats, changes: DashboardData["changes"]) {
    return [
        { title: "Active Inventory", value: stats.activeVehicles, delta: changes.activeVehicles, subtitle: `${stats.totalVehicles} total`, href: "/inventory?status=Active" },
        { title: "Open Leads", value: stats.totalLeads, delta: changes.leads, subtitle: "In pipeline", href: "/leads" },
        { title: "Sales Revenue", value: stats.totalRevenue ?? stats.totalSales, delta: changes.sales, subtitle: `${stats.totalSales} deals`, href: "/deals", format: "currency" as const },
        { title: "Customers", value: stats.totalCustomers, delta: changes.customers, subtitle: "In directory", href: "/customers" },
        { title: "Pending Invoices", value: stats.pendingInvoices, delta: changes.invoices, subtitle: `${stats.totalInvoices} total`, href: "/invoices?status=Pending" },
    ];
}

// ── Main page ────────────────────────────────────────────────────────
export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [leadsSourceData, setLeadsSourceData] = useState<ChartData[]>([]);
    const [inventoryData, setInventoryData] = useState<ChartData[]>([]);
    const [salesStatusData, setSalesStatusData] = useState<ChartData[]>([]);
    const [expensesData, setExpensesData] = useState<ChartData[]>([]);
    const [topVehicles, setTopVehicles] = useState<{ name: string; price: number; days: number; href?: string }[]>([]);
    const [upcomingFollowUps, setUpcomingFollowUps] = useState<DashboardFollowUp[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [myTasks, setMyTasks] = useState<DashboardTask[]>([]);
    const [myLeadCount, setMyLeadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function fetchAll() {
            try {
                const meRes = await apiFetch<{ data: UserProfile }>("/api/me", { silent: true });
                if (cancelled) return;
                const profile = meRes.data;
                setUserProfile(profile);

                const isPlatformAdmin = profile?.is_platform_admin;
                const userRole = profile?.role;

                if (isPlatformAdmin) {
                    const analytics = await apiFetch<DashboardAnalytics>("/api/platform/analytics", { silent: true });
                    if (cancelled) return;
                    setData({
                        stats: {
                            totalVehicles: analytics?.dealerships?.total ?? 0,
                            totalCustomers: analytics?.users?.total ?? 0,
                            totalLeads: 0,
                            totalSales: 0,
                            totalInvoices: 0,
                            activeVehicles: 0,
                            pendingInvoices: 0,
                        },
                        changes: { vehicles: 0, customers: 0, leads: 0, sales: 0, invoices: 0, activeVehicles: 0 },
                        recentSales: [],
                        recentLeads: [],
                    });
                } else if (userRole === "Salesperson" || userRole === "Staff") {
                    const [tasksRes, leadsRes] = await Promise.all([
                        apiFetch<{ data: DashboardTask[] }>("/api/tasks?my_tasks=true&limit=20", { silent: true }),
                        // Salesperson/Staff leads API auto-scopes to assigned_to
                        apiFetch<{ data: RecentLead[]; count?: number }>("/api/leads?limit=1", { silent: true }).catch(() => ({ data: [] as RecentLead[] })),
                    ]);
                    if (cancelled) return;
                    setMyTasks(tasksRes.data ?? []);
                    const leadTotal =
                        typeof (leadsRes as { count?: number }).count === "number"
                            ? (leadsRes as { count: number }).count
                            : (leadsRes.data ?? []).length;
                    setMyLeadCount(leadTotal);
                } else {
                    const [dash, leads, vehicles, deals, expenses, followUps] = await Promise.all([
                        apiFetch<DashboardData>("/api/dashboard", { silent: true }),
                        apiFetch<{ data: RecentLead[] }>("/api/leads?limit=1000", { silent: true }),
                        apiFetch<{ data: DashboardVehicle[] }>("/api/vehicles?limit=1000", { silent: true }),
                        apiFetch<{ data: RecentSale[] }>("/api/deals?limit=1000", { silent: true }),
                        apiFetch<{ data: DashboardExpense[] }>("/api/expenses?limit=1000", { silent: true }),
                        apiFetch<{ data: DashboardFollowUp[] }>("/api/follow-ups?limit=20", { silent: true }).catch(() => ({ data: [] })),
                    ]);
                    if (cancelled) return;
                    // /api/dashboard returns stats at the TOP level (no { data } wrapper)
                    const d = dash;
                    const vehicleRows = vehicles.data ?? [];
                    setData({
                        stats: {
                            totalVehicles: d?.stats?.totalVehicles ?? vehicleRows.length ?? 0,
                            totalCustomers: d?.stats?.totalCustomers ?? 0,
                            totalLeads: d?.stats?.totalLeads ?? leads.data?.length ?? 0,
                            totalSales: d?.stats?.totalSales ?? deals.data?.length ?? 0,
                            totalRevenue: d?.stats?.totalRevenue ?? 0,
                            totalInvoices: d?.stats?.totalInvoices ?? 0,
                            activeVehicles: d?.stats?.activeVehicles ?? vehicleRows.filter((v) => v.status === "Active").length ?? 0,
                            pendingInvoices: d?.stats?.pendingInvoices ?? 0,
                        },
                        changes: d?.changes ?? { vehicles: 0, customers: 0, leads: 0, sales: 0, invoices: 0, activeVehicles: 0 },
                        recentSales: d?.recentSales ?? [],
                        recentLeads: d?.recentLeads ?? leads.data?.slice(0, 5) ?? [],
                    });

                    // Build chart data
                    setLeadsSourceData(buildLeadsSourceData(leads.data ?? []));
                    setInventoryData(buildInventoryData(vehicleRows));
                    setSalesStatusData(buildSalesStatusData(deals.data ?? []));
                    setExpensesData(buildExpensesData(expenses.data ?? []));
                    setTopVehicles(buildTopVehicles(vehicleRows));
                    setUpcomingFollowUps(
                        (followUps.data ?? [])
                            .filter((f) => (f.status || "").toLowerCase() !== "completed")
                            .slice(0, 5)
                    );
                }
            } catch (e: unknown) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchAll();
        return () => {
            cancelled = true;
        };
    }, []);

    // ── Loading state ──
    if (loading) {
        return (
            <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
                <PageHeader title="Dashboard" description="Loading your dealership overview…" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-28" />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    // ── Error state ──
    if (error) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
                <EmptyState
                    kind="error"
                    title="Couldn't load dashboard"
                    description={error}
                    action={{ label: "Retry", onClick: () => window.location.reload() }}
                />
            </div>
        );
    }

    // ── Personal dashboard for Salesperson/Staff ──
    if (userProfile && (userProfile.role === "Salesperson" || userProfile.role === "Staff")) {
        return <PersonalDashboard userProfile={userProfile} myTasks={myTasks} myLeadCount={myLeadCount} />;
    }

    // ── Platform admin ──
    if (userProfile?.is_platform_admin) {
        return <PlatformAdminDashboard userProfile={userProfile} />;
    }

    // ── Admin / Manager dashboard ──
    if (!data) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
                <EmptyState kind="no-results" title="No data yet" description="Add some data to see your dashboard." />
            </div>
        );
    }
    return (
        <ManagerDashboard
            data={data}
            userProfile={userProfile}
            leadsSourceData={leadsSourceData}
            inventoryData={inventoryData}
            salesStatusData={salesStatusData}
            expensesData={expensesData}
            topVehicles={topVehicles}
            upcomingFollowUps={upcomingFollowUps}
        />
    );
}

// ── Manager / Admin dashboard ────────────────────────────────────────
function ManagerDashboard({
    data,
    userProfile,
    leadsSourceData,
    inventoryData,
    salesStatusData,
    expensesData,
    topVehicles,
    upcomingFollowUps,
}: {
    data: DashboardData;
    userProfile: UserProfile | null;
    leadsSourceData: ChartData[];
    inventoryData: ChartData[];
    salesStatusData: ChartData[];
    expensesData: ChartData[];
    topVehicles: { name: string; price: number; days: number; href?: string }[];
    upcomingFollowUps: DashboardFollowUp[];
}) {
    const router = useRouter();
    const { stats, changes, recentSales, recentLeads } = data;
    const statCards = buildStatCards(stats, changes);
    const firstName = userProfile?.full_name?.split(" ")[0] ?? "there";

    return (
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-4 sm:px-5 lg:px-6">
            <PageHeader
                title="Dashboard"
                description={`Welcome back, ${firstName}.`}
                icon={LayoutDashboard}
                actions={
                    <>
                        <Button variant="outline" size="sm" leftIcon={<FileText className="h-4 w-4" />} onClick={() => router.push("/reports")}>
                            View reports
                        </Button>
                        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push("/inventory/new")}>
                            New vehicle
                        </Button>
                    </>
                }
                meta={
                    <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                }
            />

            <MetricStrip
                items={statCards.map((stat) => ({
                    label: stat.title,
                    value: stat.value,
                    delta: stat.delta,
                    hint: stat.subtitle,
                    tooltip: `Open ${stat.title.toLowerCase()}`,
                    format: stat.format,
                    onClick: () => router.push(stat.href),
                }))}
            />

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickAction icon={Plus} tint="bg-primary-50 text-primary" label="Add vehicle" sub="Intake wizard" onClick={() => router.push("/inventory/new")} />
                <QuickAction icon={User} tint="bg-status-sold-50 text-status-sold" label="New lead" sub="Lead center" onClick={() => router.push("/leads")} />
                <QuickAction icon={DollarSign} tint="bg-success-50 text-success" label="New deal" sub="5-step create" onClick={() => router.push("/deals/new")} />
                <QuickAction icon={Calendar} tint="bg-warning-50 text-warning" label="Calendar" sub="Appointments" onClick={() => router.push("/calendar")} />
            </div>

            {/* Today panel */}
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardHeader className="border-b border-border/60 bg-transparent py-3">
                    <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-warning" />
                        <div>
                            <CardTitle className="text-base">Today</CardTitle>
                            <CardDescription>What needs your attention</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                        <TodayItem
                            icon={Inbox}
                            tint="bg-status-pending-50 text-status-pending"
                            label="Active leads in pipeline"
                            value={stats.totalLeads}
                            href="/leads"
                        />
                        <TodayItem
                            icon={FileText}
                            tint="bg-warning-50 text-warning"
                            label="Pending invoices"
                            value={stats.pendingInvoices}
                            href="/invoices?status=Pending"
                        />
                        <TodayItem
                            icon={Target}
                            tint="bg-status-active-50 text-status-active"
                            label="Vehicles ready to sell"
                            value={stats.activeVehicles}
                            href="/inventory?status=Active"
                        />
                    </div>
                </CardContent>
            </Card>

            <DeskBriefWidget />

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <ChartCard title="Leads by Source" subtitle="Top channels">
                    {leadsSourceData.length > 0 ? (
                        <>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={leadsSourceData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                                        <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {leadsSourceData.map((_, idx) => (
                                                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <ul className="mt-3 space-y-1">
                                {leadsSourceData.slice(0, 4).map((item, idx) => (
                                    <li key={item.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                            <span className="text-muted-foreground">{item.name}</span>
                                        </div>
                                        <span className="font-medium text-foreground">{item.value}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <EmptyState kind="no-results" title="No lead data" description="Add leads to see this chart." className="py-8" />
                    )}
                </ChartCard>

                <ChartCard title="Inventory Status" subtitle="Vehicle breakdown">
                    {inventoryData.length > 0 ? (
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={inventoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                                        {inventoryData.map((_, idx) => (
                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={chartTooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState kind="no-results" title="No inventory" description="Add vehicles to see this chart." className="py-8" />
                    )}
                </ChartCard>

                <ChartCard title="Sales funnel" subtitle="Pipeline by stage">
                    {salesStatusData.length > 0 ? (
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={salesStatusData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState kind="no-results" title="No sales" description="Close deals to see this chart." className="py-8" />
                    )}
                </ChartCard>

                <ChartCard title="Expenses by Category" subtitle="Top spend">
                    {expensesData.length > 0 ? (
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={expensesData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                                        {expensesData.map((_, idx) => (
                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState kind="no-results" title="No expenses" description="Log expenses to see this chart." className="py-8" />
                    )}
                </ChartCard>
            </div>

            {/* Recent activity + follow-ups + top vehicles */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-0">
                    <CardHeader className="px-5 py-4">
                        <div>
                            <CardTitle>Recent sales</CardTitle>
                            <CardDescription>Latest 5 closed or in-progress deals</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => router.push("/deals")}>
                            View all
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {recentSales.length === 0 ? (
                            <EmptyState kind="first-use" title="No sales yet" description="Closed deals will appear here." action={{ label: "Add a deal", href: "/deals/new" }} className="py-8" />
                        ) : (
                            <ul className="divide-y divide-border">
                                {recentSales.slice(0, 5).map((sale) => (
                                    <li key={sale.id} className="first:pt-0 last:pb-0">
                                        <Link
                                            href={`/deals/${sale.id}`}
                                            className="flex min-w-0 items-center gap-3 py-3 transition-colors hover:bg-muted/40 -mx-1 px-1 rounded-lg"
                                        >
                                            <Avatar name={sale.customer?.name} src={sale.customer?.avatar} size="md" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {sale.customer?.name ?? "Unknown customer"}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {sale.vehicle?.year} {sale.vehicle?.make} {sale.vehicle?.model}
                                                </p>
                                            </div>
                                            <div className="whitespace-nowrap text-right">
                                                <p className="text-sm font-semibold text-foreground tabular-nums">
                                                    {formatCurrency(sale.sale_price)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {timeAgo(sale.deal_date)}
                                                </p>
                                            </div>
                                            <StatusBadge status={sale.deal_status} resource="deal" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="p-0">
                    <CardHeader className="px-5 py-4">
                        <div>
                            <CardTitle>Recent leads</CardTitle>
                            <CardDescription>Latest 5 prospects</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => router.push("/leads")}>
                            View all
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {recentLeads.length === 0 ? (
                            <EmptyState kind="first-use" title="No leads yet" description="New prospects will appear here." action={{ label: "Add a lead", href: "/leads" }} className="py-8" />
                        ) : (
                            <ul className="divide-y divide-border">
                                {recentLeads.slice(0, 5).map((lead) => (
                                    <li key={lead.id} className="first:pt-0 last:pb-0">
                                        <Link
                                            href="/leads"
                                            className="flex min-w-0 items-center gap-3 py-3 transition-colors hover:bg-muted/40 -mx-1 px-1 rounded-lg"
                                        >
                                            <Avatar name={lead.customer?.name} src={lead.customer?.avatar} size="md" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {lead.customer?.name ?? "Unknown"}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {lead.source} · {timeAgo(lead.lead_creation_date)}
                                                </p>
                                            </div>
                                            {lead.assigned_user && (
                                                <div className="hidden min-w-0 sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Avatar name={lead.assigned_user.full_name} src={lead.assigned_user.avatar} size="xs" />
                                                    <span className="min-w-0 max-w-[100px] truncate">{lead.assigned_user.full_name}</span>
                                                </div>
                                            )}
                                            <StatusBadge status={lead.status} resource="lead" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="p-0">
                    <CardHeader className="px-5 py-4">
                        <div>
                            <CardTitle>Upcoming follow-ups</CardTitle>
                            <CardDescription>Next actions due</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => router.push("/follow-ups")}>
                            View all
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {upcomingFollowUps.length === 0 ? (
                            <EmptyState kind="first-use" title="No follow-ups" description="Scheduled follow-ups show here." action={{ label: "Open follow-ups", href: "/follow-ups" }} className="py-8" />
                        ) : (
                            <ul className="divide-y divide-border">
                                {upcomingFollowUps.map((fu) => (
                                    <li key={fu.id} className="first:pt-0 last:pb-0">
                                        <Link
                                            href="/follow-ups"
                                            className="flex min-w-0 items-center gap-3 py-3 transition-colors hover:bg-muted/40 -mx-1 px-1 rounded-lg"
                                        >
                                            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-warning-50 text-warning">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {fu.customer?.name || fu.subject || "Follow-up"}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {fu.follow_up_date
                                                        ? new Date(fu.follow_up_date).toLocaleDateString()
                                                        : "No date"}
                                                    {fu.priority ? ` · ${fu.priority}` : ""}
                                                </p>
                                            </div>
                                            <StatusBadge status={fu.status || "Pending"} resource="task" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="p-0">
                    <CardHeader className="px-5 py-4">
                        <div>
                            <CardTitle>Top vehicles</CardTitle>
                            <CardDescription>Highest retail, active stock</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => router.push("/inventory")}>
                            Inventory
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {topVehicles.length === 0 ? (
                            <EmptyState kind="first-use" title="No active vehicles" description="Add inventory to see top units." action={{ label: "Add vehicle", href: "/inventory/new" }} className="py-8" />
                        ) : (
                            <ul className="divide-y divide-border">
                                {topVehicles.map((v, idx) => {
                                    const row = (
                                        <>
                                            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                                                <p className="whitespace-nowrap text-xs text-muted-foreground">{v.days}d in stock</p>
                                            </div>
                                            <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">
                                                {formatCurrency(v.price)}
                                            </p>
                                        </>
                                    );
                                    return (
                                        <li key={`${v.name}-${idx}`} className="first:pt-0 last:pb-0">
                                            {v.href ? (
                                                <Link
                                                    href={v.href}
                                                    className="flex min-w-0 items-center gap-3 py-3 transition-colors hover:bg-muted/40 -mx-1 px-1 rounded-lg"
                                                >
                                                    {row}
                                                </Link>
                                            ) : (
                                                <div className="flex min-w-0 items-center gap-3 py-3">{row}</div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ── Personal dashboard (Salesperson/Staff) ──────────────────────────
function PersonalDashboard({
    userProfile,
    myTasks,
    myLeadCount,
}: {
    userProfile: UserProfile | null;
    myTasks: DashboardTask[];
    myLeadCount: number;
}) {
    const router = useRouter();
    const pendingTasks = myTasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
    const completedTasks = myTasks.filter((t) => t.status === "Completed");
    const firstName = userProfile?.full_name?.split(" ")[0] ?? "there";

    return (
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-4 sm:px-5 lg:px-6">
            <PageHeader
                title="My dashboard"
                description={`Welcome back, ${firstName}.`}
                actions={
                    <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push("/leads")}>
                        New lead
                    </Button>
                }
            />

            <MetricStrip
                items={[
                    { label: "My tasks", value: myTasks.length, hint: `${pendingTasks.length} pending`, onClick: () => router.push("/tasks") },
                    { label: "Pending", value: pendingTasks.length, tone: "warning", onClick: () => router.push("/tasks") },
                    { label: "Completed", value: completedTasks.length, tone: "success", onClick: () => router.push("/tasks") },
                    { label: "My leads", value: myLeadCount, onClick: () => router.push("/leads") },
                ]}
            />

            <Card className="p-0">
                <CardHeader className="px-5 py-4">
                    <CardTitle>My open tasks</CardTitle>
                </CardHeader>
                <CardContent>
                    {pendingTasks.length === 0 ? (
                        <EmptyState kind="first-use" title="All caught up" description="No pending tasks." className="py-8" />
                    ) : (
                        <ul className="divide-y divide-border">
                            {pendingTasks.slice(0, 10).map((task) => (
                                <li key={task.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                                    <Avatar name={task.title} size="md" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                                        {task.description && <p className="truncate text-xs text-muted-foreground">{task.description}</p>}
                                    </div>
                                    {task.due_date && (
                                        <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                                            <Calendar className="mr-1 inline h-3 w-3" />
                                            {new Date(task.due_date).toLocaleDateString()}
                                        </span>
                                    )}
                                    <StatusBadge status={task.status} resource="task" />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <QuickAction icon={User} tint="bg-primary-50 text-primary" label="My leads" sub="View assigned leads" onClick={() => router.push("/leads")} />
                <QuickAction icon={Briefcase} tint="bg-info-50 text-info" label="My deals" sub="View assigned deals" onClick={() => router.push("/deals")} />
                <QuickAction icon={Calendar} tint="bg-warning-50 text-warning" label="Test drives" sub="Upcoming" onClick={() => router.push("/test-drives")} />
            </div>
        </div>
    );
}

function QuickAction({ icon: Icon, tint, label, sub, onClick }: { icon: LucideIcon; tint: string; label: string; sub: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm"
        >
            <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", tint)}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </button>
    );
}

// ── Platform admin dashboard ────────────────────────────────────────
function PlatformAdminDashboard({ userProfile: _userProfile }: { userProfile: UserProfile | null }) {
    const router = useRouter();
    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
            <PageHeader
                title="Platform dashboard"
                description="Cross-dealership overview. Only visible to platform admins."
                actions={
                    <>
                        <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />} onClick={() => router.push("/platform/analytics")}>
                            Platform analytics
                        </Button>
                        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push("/dealerships")}>
                            Manage dealerships
                        </Button>
                    </>
                }
            />
            <EmptyState
                kind="no-results"
                title="Platform analytics coming up"
                description="Visit the Analytics page for full cross-dealership reporting."
                action={{ label: "Open analytics", href: "/platform/analytics" }}
            />
        </div>
    );
}

// ── Reusable chart card ─────────────────────────────────────────────
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <Card className="p-0">
            <CardHeader className="px-5 py-4">
                <div>
                    <CardTitle>{title}</CardTitle>
                    {subtitle && <CardDescription>{subtitle}</CardDescription>}
                </div>
            </CardHeader>
            <CardContent className="pt-0">{children}</CardContent>
        </Card>
    );
}

// ── Data aggregators ────────────────────────────────────────────────
function buildLeadsSourceData(leads: Array<{ source?: string | null }>): ChartData[] {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
        const s = lead.source || "Unknown";
        counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
}
function buildInventoryData(vehicles: Array<{ status?: string | null }>): ChartData[] {
    const counts: Record<string, number> = {};
    for (const v of vehicles) {
        const s = v.status || "Unknown";
        counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
}
function buildSalesStatusData(deals: Array<{ deal_status?: string | null; status?: string | null }>): ChartData[] {
    const counts: Record<string, number> = {};
    for (const d of deals) {
        const s = d.deal_status || d.status || "Unknown";
        counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
}
function buildExpensesData(expenses: Array<{ category?: string | null }>): ChartData[] {
    const counts: Record<string, number> = {};
    for (const e of expenses) {
        const c = e.category || "Other";
        counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
}

function buildTopVehicles(
    vehicles: Array<{
        status?: string | null;
        created_at?: string | null;
        vin?: string | null;
        year?: string | number | null;
        make?: string | null;
        model?: string | null;
        retail_price?: number | null;
    }>
): { name: string; price: number; days: number; href?: string }[] {
    const now = Date.now();
    return vehicles
        .filter((v) => (v.status || "") === "Active")
        .map((v) => {
            const created = v.created_at ? new Date(v.created_at).getTime() : now;
            const days = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
            const vin = typeof v.vin === "string" && v.vin.trim() ? v.vin.trim() : null;
            return {
                name: `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || "Vehicle",
                price: Number(v.retail_price) || 0,
                days,
                href: vin ? `/inventory/${encodeURIComponent(vin)}` : undefined,
            };
        })
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
}
