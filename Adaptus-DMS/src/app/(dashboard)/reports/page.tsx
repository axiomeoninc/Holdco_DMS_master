"use client";

import { useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import {
    TrendingUp,
    Users,
    DollarSign,
    Car,
    FileText,
    Loader2,
    AlertCircle,
    Download,
    RefreshCw,
    TrendingDown,
    Target,
    FileSpreadsheet,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { CHART_COLORS } from "@/src/components/ui/chart";
import { DatePicker } from "@/src/components/ui/date-picker";

const COLORS = CHART_COLORS;

interface ReportSummary {
    totalLeads?: number;
    newLeads?: number;
    convertedLeads?: number;
    conversionRate?: number;
    totalRevenue?: number;
    totalDeals?: number;
    avgDealPrice?: number;
    frontEndGross?: number;
    totalVehicles?: number;
    activeVehicles?: number;
    totalInventoryValue?: number;
    agingCount?: number;
    revenue?: number;
    deals?: number;
    commission?: number;
    totalExpenses?: number;
    expenseCount?: number;
    netIncome?: number;
    profitMargin?: number;
}

interface SourceCountRow {
    source: string;
    count: number;
}

interface StatusCountRow {
    status: string;
    count: number;
}

interface CategoryRow {
    category: string;
    count?: number;
    total?: number;
    amount?: number;
}

interface SalesDayRow {
    date: string;
    revenue?: number;
    amount?: number;
    count?: number;
    deals?: number;
}

interface SalespersonRow {
    salespersonId?: string;
    name: string;
    deals: number;
    revenue?: number;
    frontEndGross?: number;
    commission?: number;
    commissionEstimated?: number;
    commissionFromDeals?: number;
}

interface ReportPayload {
    summary?: ReportSummary;
    note?: string;
    restricted?: boolean;
    bySource?: SourceCountRow[];
    // leads reports return an array, inventory reports return a Record
    byStatus?: StatusCountRow[] | Record<string, number>;
    byCategory?: CategoryRow[];
    salesByDate?: SalesDayRow[];
    topSalespeople?: SalespersonRow[];
    bySalesperson?: SalespersonRow[];
    agingBuckets?: Record<string, number>;
    outstandingInvoices?: { total?: number };
    expensesByCategory?: unknown[];
}

interface ReportData {
    reportType: string;
    period: { startDate: string; endDate: string };
    data: ReportPayload;
    error?: string;
}

const DATE_PRESETS = [
    { label: "Today", days: 0 },
    { label: "This Week", days: 7 },
    { label: "This Month", days: 30 },
    { label: "This Quarter", days: 90 },
    { label: "This Year", days: 365 },
];

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"leads" | "sales" | "inventory" | "financial" | "expenses" | "salesperson">("leads");
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [datePreset, setDatePreset] = useState(30);
    const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);

    const getDateRange = () => {
        if (customDateRange) return customDateRange;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - datePreset);
        return {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0]
        };
    };

    async function fetchReport() {
        try {
            setLoading(true);
            setError(null);

            const { start, end } = getDateRange();
            // "Summary" tab id is `financial` — must hit type=financial (not summary)
            // so outstanding invoices / expense categories / net income populate.
            const type = activeTab;

            const json = await apiFetch<ReportData>(`/api/reports?type=${type}&start_date=${start}&end_date=${end}`);
            if (json.error) throw new Error(json.error);
            setReportData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // Defer to the next tick so the synchronous setState inside fetchReport
        // doesn't run while React is still committing the effect.
        const t = setTimeout(() => void fetchReport(), 0);
        return () => clearTimeout(t);
    }, [activeTab, datePreset, customDateRange]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
    };

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error("Clipboard error:", error);
            return false;
        }
    };

    async function exportToCSV() {
        if (!reportData) return;
        const { data } = reportData;
        let csvContent = "";

        if (activeTab === "leads" && data.bySource) {
            csvContent = "Source,Count\n";
            csvContent += data.bySource.map((s) => `${s.source},${s.count}`).join("\n");
        } else if (activeTab === "sales" && data.salesByDate) {
            csvContent = "Date,Revenue,Deals\n";
            csvContent += data.salesByDate
                .map((s) => `${s.date},${s.revenue ?? s.amount ?? 0},${s.count ?? s.deals ?? 0}`)
                .join("\n");
        } else if (activeTab === "salesperson" && data.bySalesperson) {
            csvContent = "Salesperson,Deals,Revenue,FrontEndGross,Commission\n";
            csvContent += data.bySalesperson
                .map(
                    (s) =>
                        `"${String(s.name || "").replace(/"/g, '""')}",${s.deals ?? 0},${s.revenue ?? 0},${s.frontEndGross ?? 0},${s.commission ?? 0}`
                )
                .join("\n");
        } else if (activeTab === "inventory" && data.byStatus) {
            csvContent = "Status,Count\n";
            // byStatus is a Record<string, number>, not an array
            csvContent += Object.entries(data.byStatus)
                .map(([status, count]) => `${status},${count}`)
                .join("\n");
        } else if (activeTab === "expenses" && data.byCategory) {
            csvContent = "Category,Count,Total\n";
            csvContent += data.byCategory
                .map((s) => `${s.category},${s.count ?? ""},${s.total ?? s.amount ?? 0}`)
                .join("\n");
        } else if (activeTab === "financial" && data.summary) {
            csvContent = "Metric,Value\n";
            csvContent += [
                `Revenue,${data.summary.totalRevenue ?? 0}`,
                `Expenses,${data.summary.totalExpenses ?? 0}`,
                `Net Income,${data.summary.netIncome ?? 0}`,
                `Profit Margin %,${data.summary.profitMargin ?? 0}`,
                `Outstanding,${data.outstandingInvoices?.total ?? 0}`,
            ].join("\n");
        }

        if (!csvContent) {
            toast.error("Nothing to export for this view");
            return;
        }

        try {
            // Blob download works in regular browsers. Some embedded browsers
            // block blob downloads silently, so ALSO copy the CSV to the
            // clipboard as a guaranteed fallback and always show feedback.
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${activeTab}-report-${new Date().toISOString().split("T")[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            const csvCopied = await copyToClipboard(csvContent);
            toast.success(
                `Exported ${activeTab} report` + (csvCopied ? " — CSV copied to clipboard" : "")
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export report");
        }
    }

    const { start, end } = getDateRange();

    const tabs = [
        { id: "leads", label: "Leads", icon: Users },
        { id: "sales", label: "Sales", icon: TrendingUp },
        { id: "salesperson", label: "Commissions", icon: Target },
        { id: "inventory", label: "Inventory", icon: Car },
        { id: "expenses", label: "Expenses", icon: DollarSign },
        { id: "financial", label: "Summary", icon: FileText },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
                    <p className="text-sm text-slate-600 mt-1" suppressHydrationWarning>
                        {start && end ? `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}` : "Analytics & Insights"}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchReport}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={exportToCSV}
                        disabled={!reportData}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <a
                        href="/settings/accounting"
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        title="QuickBooks / Xero / Sage 50 journal export"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Accounting journal
                    </a>
                </div>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap gap-2">
                    {DATE_PRESETS.map((preset) => (
                        <button
                            key={preset.days}
                            onClick={() => {
                                setDatePreset(preset.days);
                                setCustomDateRange(null);
                            }}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                datePreset === preset.days && !customDateRange
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                    <div className="flex gap-2 ml-auto items-center">
                        <DatePicker
                            value={start}
                            onChange={(iso) => setCustomDateRange({ start: iso, end })}
                            placeholder="Start"
                            className="w-[150px]"
                        />
                        <span className="text-gray-400">to</span>
                        <DatePicker
                            value={end}
                            onChange={(iso) => setCustomDateRange({ start, end: iso })}
                            placeholder="End"
                            className="w-[150px]"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? "border-blue-600 text-blue-600 bg-blue-50"
                                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center min-h-[300px]">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center min-h-[300px]">
                            <div className="text-center">
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                                <p className="text-red-600">{error}</p>
                                <button onClick={fetchReport} className="mt-2 text-sm text-blue-600 hover:underline">
                                    Try again
                                </button>
                            </div>
                        </div>
                    ) : reportData ? (
                        <ReportContent data={reportData.data} activeTab={activeTab} formatCurrency={formatCurrency} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function ReportContent({ data, activeTab, formatCurrency }: { data: ReportPayload; activeTab: string; formatCurrency: (v: number) => string }) {
    if (activeTab === "leads") {
        const totalLeads = data.summary?.totalLeads || 0;
        const newLeads = data.summary?.newLeads || 0;
        const convertedLeads = data.summary?.convertedLeads || 0;
        const conversionRate = data.summary?.conversionRate || 0;
        const byStatusArr = (data.byStatus as StatusCountRow[]) || [];

        return (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-blue-700">Total Leads</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{totalLeads}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            <span className="text-sm text-purple-700">New Leads</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">{newLeads}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-700">Converted</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">{convertedLeads}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-5 h-5 text-orange-600" />
                            <span className="text-sm text-orange-700">Conversion Rate</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-900">{conversionRate.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Leads by Source */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Source</h3>
                        {data.bySource && data.bySource.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={data.bySource} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" tickFormatter={(v) => String(Math.round(v))} />
                                        <YAxis type="category" dataKey="source" width={80} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value: unknown) => [String(value), "Leads"]} />
                                        <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {[...data.bySource].sort((a, b) => b.count - a.count).map((item, idx: number) => (
                                        <div key={item.source} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                <span className="text-sm text-gray-700">{item.source}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">{item.count}</span>
                                                <span className="text-xs text-gray-500">
                                                    ({totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : 0}%)
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-gray-500">
                                No lead source data available
                            </div>
                        )}
                    </div>

                    {/* Leads by Status */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Status</h3>
                        {data.byStatus && byStatusArr.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={byStatusArr}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="count"
                                            nameKey="status"
                                        >
                                            {byStatusArr.map((_, idx: number) => (
                                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {byStatusArr.map((item, idx: number) => (
                                        <div key={item.status} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                <span className="text-sm text-gray-700">{item.status}</span>
                                            </div>
                                            <span className="text-sm font-medium">{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-gray-500">
                                No status data available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === "sales") {
        const summary = data.summary || {};
        const totalRevenue = summary.totalRevenue || 0;
        const totalDeals = summary.totalDeals || 0;
        const avgDealSize = summary.avgDealPrice || 0;
        const frontEndGross = summary.frontEndGross ?? null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-700">Total Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-blue-700">Total Deals</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{totalDeals}</p>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-slate-600" />
                            <span className="text-sm text-slate-700">Avg Deal Size</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgDealSize)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-100">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-teal-600" />
                            <span className="text-sm text-teal-700">Front-end Gross</span>
                        </div>
                        <p className="text-2xl font-bold text-teal-900">
                            {frontEndGross == null ? "—" : formatCurrency(frontEndGross)}
                        </p>
                        <p className="mt-1 text-xs text-teal-700/80">Sale − vehicle cost</p>
                    </div>
                </div>

                {/* Sales Chart */}
                {data.salesByDate && data.salesByDate.length > 0 ? (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.salesByDate}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value)), "Revenue"]} />
                                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 text-center text-gray-500">
                        No sales data available for this period
                    </div>
                )}

                {data.topSalespeople && data.topSalespeople.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top salespeople</h3>
                        <div className="space-y-2">
                            {data.topSalespeople.map((sp, idx: number) => (
                                <div key={sp.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 text-gray-400">{idx + 1}.</span>
                                        <span className="font-medium text-gray-900">{sp.name}</span>
                                        <span className="text-gray-500">{sp.deals} deals</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-medium">{formatCurrency(sp.revenue || 0)}</span>
                                        {sp.commission != null && sp.commission > 0 && (
                                            <span className="ml-3 text-xs text-gray-500">
                                                Comm. {formatCurrency(sp.commission)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (activeTab === "salesperson") {
        const summary = data.summary || {};
        const rows = data.bySalesperson || [];
        const hasEstimates = rows.some(
            (row: { commissionEstimated?: number }) =>
                Number(row.commissionEstimated || 0) > 0
        );
        return (
            <div className="space-y-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">Commission figures are estimates — not payroll.</p>
                    <p className="mt-1 text-amber-800/90">
                        Uses stored deal <code className="text-xs bg-amber-100 px-1 rounded">commission_amount</code>
                        {" "}or <code className="text-xs bg-amber-100 px-1 rounded">commission_rate</code> when set;
                        otherwise estimates 25% of front-end gross. Do not use this tab for payroll or tax remittance
                        {hasEstimates ? " — some rows include estimated amounts." : "."}
                    </p>
                    {data.note && (
                        <p className="mt-2 text-xs text-amber-700/80">{data.note}</p>
                    )}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-700">Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(summary.revenue || 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-blue-700">Deals</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{summary.deals || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-teal-600" />
                            <span className="text-sm text-teal-700">Front-end Gross</span>
                        </div>
                        <p className="text-2xl font-bold text-teal-900">{formatCurrency(summary.frontEndGross || 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                            <span className="text-sm text-amber-700">Commission (est.)</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-900">{formatCurrency(summary.commission || 0)}</p>
                    </div>
                </div>
                {rows.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Salesperson</th>
                                    <th className="px-4 py-3 text-right">Deals</th>
                                    <th className="px-4 py-3 text-right">Revenue</th>
                                    <th className="px-4 py-3 text-right">Front-end Gross</th>
                                    <th className="px-4 py-3 text-right">Commission</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {rows.map((row) => (
                                    <tr key={row.salespersonId || row.name}>
                                        <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{row.deals}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.revenue || 0)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.frontEndGross || 0)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                                            {formatCurrency(row.commission || 0)}
                                            {Number(row.commissionEstimated || 0) > 0 &&
                                                Number(row.commissionFromDeals || 0) === 0 && (
                                                <span className="ml-1 text-xs font-normal text-amber-600">est.</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 text-center text-gray-500">
                        No salesperson deals in this period
                    </div>
                )}
            </div>
        );
    }

    if (activeTab === "inventory") {
        const summary = data.summary || {};
        const agingBuckets = data.agingBuckets ?? {};
        const totalVehicles = summary.totalVehicles || 0;
        const activeVehicles = summary.activeVehicles || 0;
        const soldVehicles = (data.byStatus as Record<string, number> | undefined)?.["Sold"] || 0;
        const avgPrice = summary.totalInventoryValue && totalVehicles ? summary.totalInventoryValue / totalVehicles : 0;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Car className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-blue-700">Total Vehicles</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{totalVehicles}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Car className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-700">Active</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">{activeVehicles}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Car className="w-5 h-5 text-orange-600" />
                            <span className="text-sm text-orange-700">Sold</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-900">{soldVehicles}</p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-gray-600" />
                            <span className="text-sm text-gray-700">Avg Price</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgPrice)}</p>
                    </div>
                </div>

                {/* Inventory Status */}
                {data.byStatus && Object.keys(data.byStatus).length > 0 ? (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Status</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={Object.entries(data.byStatus).map(([status, count]) => ({ status, count }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={120}
                                    paddingAngle={2}
                                    dataKey="count"
                                    nameKey="status"
                                >
                                    {Object.entries(data.byStatus).map(([status], idx) => (
                                        <Cell key={status} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 text-center text-gray-500">
                        No inventory data available
                    </div>
                )}

                {/* Aging buckets */}
                {data.agingBuckets && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Inventory aging</h3>
                        <p className="text-sm text-gray-500 mb-4">Days in stock (Active units)</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(["0-30", "31-60", "61-90", "90+"] as const).map((bucket) => (
                                <div key={bucket} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{bucket} days</p>
                                    <p className="mt-1 text-2xl font-bold text-gray-900">
                                        {agingBuckets[bucket] ?? 0}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {summary.agingCount != null && (
                            <p className="mt-3 text-xs text-gray-500">
                                {summary.agingCount} active unit{summary.agingCount === 1 ? "" : "s"} over 30 days
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (activeTab === "expenses") {
        const summary = data.summary || {};
        const totalExpenses = summary.totalExpenses || 0;
        const expenseCount = summary.expenseCount || 0;
        const avgExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

        return (
            <div className="space-y-6">
                {data.restricted && data.note && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        {data.note}
                    </p>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-red-600" />
                            <span className="text-sm text-red-700">Total Expenses</span>
                        </div>
                        <p className="text-2xl font-bold text-red-900">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-blue-700">Categories</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{summary.expenseCount || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-5 h-5 text-purple-600" />
                            <span className="text-sm text-purple-700">Avg Expense</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">{formatCurrency(avgExpense)}</p>
                    </div>
                </div>

                {/* Expenses by Category */}
                {data.byCategory && data.byCategory.length > 0 ? (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.byCategory} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} />
                                <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value)), "Total"]} />
                                <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 space-y-2">
                            {[...data.byCategory].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).map((item, idx: number) => (
                                <div key={item.category} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                        <span className="text-sm text-gray-700">{item.category}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium">{formatCurrency(item.total ?? 0)}</span>
                                        <span className="text-xs text-gray-500">({item.count})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 text-center text-gray-500">
                        No expense data available
                    </div>
                )}
            </div>
        );
    }

    if (activeTab === "financial") {
        const summary = data.summary || {};
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-700">Revenue (QTD)</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(summary.totalRevenue || 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                            <span className="text-sm text-red-700">Expenses (QTD)</span>
                        </div>
                        <p className="text-2xl font-bold text-red-900">{formatCurrency(summary.totalExpenses || 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Car className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-blue-700">Net Income</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{formatCurrency(summary.netIncome || 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                            <span className="text-sm text-purple-700">Profit Margin</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">{summary.profitMargin?.toFixed(1) || 0}%</p>
                    </div>
                </div>

                {/* Quick Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Net Income</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.netIncome || 0)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Profit Margin</p>
                        <p className="text-xl font-bold text-gray-900">{summary.profitMargin?.toFixed(1) || 0}%</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Outstanding</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(data.outstandingInvoices?.total || 0)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Categories</p>
                        <p className="text-xl font-bold text-gray-900">{data.expensesByCategory?.length || 0}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[300px] text-gray-500">
            Select a tab to view reports
        </div>
    );
}
