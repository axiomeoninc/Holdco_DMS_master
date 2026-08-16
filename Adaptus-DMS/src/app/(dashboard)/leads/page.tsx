"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Filter,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    Clock,
    CheckCircle,
    XCircle,
    UserPlus,
} from "lucide-react";
import LeadDetailsModal from "@/src/components/LeadDetailsModal";
import LeadFormModal from "@/src/components/LeadFormModal";
import LeadsKanban from "@/src/components/LeadsKanban";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { resolveListEmptyKind } from "@/src/components/ui/DataTable";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { RowActionsMenu } from "@/src/components/ui/RowActionsMenu";
import { Avatar } from "@/src/components/ui/Avatar";
import { RelationChip } from "@/src/components/ui/RelationChip";
import { cn, timeAgo } from "@/src/lib/utils";
import {
    resolveLeadScore,
    temperatureClass,
} from "@/src/lib/business/lead-score";
import {
    canDelete as canDeleteResource,
    canEdit as canEditResource,
} from "@/src/lib/permission-middleware";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { useLocations } from "@/src/hooks/useLocations";

interface Lead {
    id: string;
    customer_id: string;
    source: string;
    status: string;
    interest_vehicle_id: string | null;
    assigned_to: string | null;
    notes: string | null;
    lead_creation_date: string;
    last_engagement: string;
    created_at: string;
    updated_at: string;
    score?: number | null;
    temperature?: string | null;
    converted_deal_id?: string | null;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar: string | null;
    } | null;
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
    } | null;
    assigned_user: {
        id: string;
        full_name: string;
        email: string;
        avatar: string | null;
    } | null;
}

interface ApiResponse {
    data: Lead[];
    count: number;
    limit: number;
    offset: number;
}

type ViewMode = "table" | "kanban";

const STATUS_OPTIONS = [
    { value: "Not Started", label: "Not Started" },
    { value: "In Progress", label: "In Progress" },
    { value: "Qualified", label: "Qualified" },
    { value: "Closed", label: "Closed" },
    { value: "Lost", label: "Lost" },
];

const SOURCE_OPTIONS = [
    { value: "Website", label: "Website" },
    { value: "Referral", label: "Referral" },
    { value: "Event", label: "Event" },
    { value: "Walk-in", label: "Walk-in" },
    { value: "Facebook", label: "Facebook" },
    { value: "Craigslist", label: "Craigslist" },
    { value: "Kijiji", label: "Kijiji" },
    { value: "Phone", label: "Phone" },
];

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebouncedValue(searchTerm, 300);
    const [statusFilter, setStatusFilter] = useState("");
    const [exportLoading, setExportLoading] = useState(false);
    const [sourceFilter, setSourceFilter] = useState("");
    const [temperatureFilter, setTemperatureFilter] = useState("");
    const [assigneeFilter, setAssigneeFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const { locations } = useLocations();
    const [assignees, setAssignees] = useState<{ value: string; label: string }[]>([]);
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [createdAtFrom, setCreatedAtFrom] = useState("");
    const [createdAtTo, setCreatedAtTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState("");
    const [forbidden, setForbidden] = useState(false);
    const [kpiLoading, setKpiLoading] = useState(true);
    const [kpis, setKpis] = useState({ hot: 0, warm: 0, cold: 0, total: 0 });

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        lead: Lead | null;
        loading: boolean;
    }>({ lead: null, loading: false });

    const canWrite = (resource: string): boolean => {
        return canEditResource(userRole, userPermissions, resource);
    };

    const canDelete = (resource: string): boolean => {
        return canDeleteResource(userRole, userPermissions, resource);
    };

    const buildFilterQuery = useCallback(
        (extra = "") => {
            let url = extra;
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (sourceFilter) url += `&source=${encodeURIComponent(sourceFilter)}`;
            if (temperatureFilter)
                url += `&temperature=${encodeURIComponent(temperatureFilter)}`;
            if (assigneeFilter)
                url += `&assigned_to=${encodeURIComponent(assigneeFilter)}`;
            if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
            if (createdAtFrom) url += `&created_at_from=${createdAtFrom}`;
            if (createdAtTo) url += `&created_at_to=${createdAtTo}`;
            if (locationFilter) url += `&location_id=${encodeURIComponent(locationFilter)}`;
            return url;
        },
        [
            statusFilter,
            sourceFilter,
            temperatureFilter,
            assigneeFilter,
            debouncedSearch,
            createdAtFrom,
            createdAtTo,
            locationFilter,
        ]
    );

    async function fetchUserPermissions() {
        try {
            const response = await fetch("/api/me");
            if (response.ok) {
                const data = await response.json();
                setUserPermissions(data.data.user_permissions || []);
                setUserRole(data.data.role || "");
            }
        } catch (err) {
            console.error("Error fetching user permissions:", err);
        }
        try {
            const usersRes = await fetch("/api/users?limit=100");
            if (usersRes.ok) {
                const usersData = await usersRes.json();
                setAssignees(
                    (usersData.data || []).map(
                        (u: { id: string; full_name: string }) => ({
                            value: u.id,
                            label: u.full_name,
                        })
                    )
                );
            }
        } catch {
            // non-blocking
        }
    }

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;
            const url = `/api/leads?limit=${itemsPerPage}&offset=${offset}${buildFilterQuery()}`;

            const response = await fetch(url);
            if (response.status === 403) {
                setForbidden(true);
                throw new Error("You don't have access to leads");
            }
            if (!response.ok) {
                setForbidden(false);
                throw new Error("Failed to fetch leads");
            }
            setForbidden(false);

            const data: ApiResponse = await response.json();
            setLeads(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, buildFilterQuery]);

    const fetchKpis = useCallback(async () => {
        try {
            setKpiLoading(true);
            const url = `/api/leads?limit=10000&offset=0${buildFilterQuery()}`;
            const response = await fetch(url);
            if (!response.ok) return;
            const data: ApiResponse = await response.json();
            let hot = 0;
            let warm = 0;
            let cold = 0;
            for (const lead of data.data || []) {
                const temp = resolveLeadScore(lead).temperature;
                if (temp === "Hot") hot += 1;
                else if (temp === "Warm") warm += 1;
                else cold += 1;
            }
            setKpis({ hot, warm, cold, total: data.count || 0 });
        } catch (err) {
            console.error("KPI fetch failed:", err);
        } finally {
            setKpiLoading(false);
        }
    }, [buildFilterQuery]);

    useEffect(() => {
        fetchUserPermissions();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, sourceFilter, temperatureFilter, assigneeFilter, createdAtFrom, createdAtTo, locationFilter]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    useEffect(() => {
        fetchKpis();
    }, [fetchKpis]);

    const buildWorksheetData = (exportData: Lead[]) =>
        exportData.map((lead) => ({
            Customer: lead.customer?.name || "Unknown",
            Email: lead.customer?.email || "",
            Phone: lead.customer?.phone || "",
            Source: lead.source || "",
            Status: lead.status || "",
            "Vehicle Interest": lead.vehicle
                ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
                : "",
            "Assigned To": lead.assigned_user?.full_name || "",
            Notes: lead.notes || "",
            "Created Date": lead.created_at
                ? new Date(lead.created_at).toLocaleDateString()
                : "",
        }));

    const toCsv = (rows: Record<string, string>[]) => {
        const cols = Object.keys(rows[0] || {});
        const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
        return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join(
            "\n"
        );
    };

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            try {
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand("copy");
                document.body.removeChild(ta);
                return ok;
            } catch {
                return false;
            }
        }
    };

    async function exportToExcel() {
        setExportLoading(true);
        try {
            const response = await fetch(`/api/leads?limit=10000${buildFilterQuery()}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch leads (${response.status})`);
            }
            const data = await response.json();
            const exportData = data.data || [];
            if (exportData.length === 0) throw new Error("No leads found to export");

            const worksheetData = buildWorksheetData(exportData);
            await downloadXlsx(
                worksheetData,
                "Leads",
                `leads-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 25 },
                    { wch: 30 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 25 },
                    { wch: 20 },
                    { wch: 30 },
                    { wch: 15 },
                ]
            );
            const csvCopied = await copyToClipboard(toCsv(worksheetData));
            toast.success(
                `Exported ${exportData.length} lead${exportData.length === 1 ? "" : "s"}` +
                    (csvCopied ? " — CSV copied to clipboard" : "")
            );
        } catch (err) {
            console.error("Export error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to export leads");
        } finally {
            setExportLoading(false);
        }
    }

    const handleViewDetails = (lead: Lead) => {
        setSelectedLead(lead);
        setShowDetailsModal(true);
    };

    const handleEdit = (lead: Lead) => {
        setSelectedLead(lead);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedLead(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedLead(null);
        fetchLeads();
        fetchKpis();
    };

    const handleDelete = (lead: Lead) => {
        setConfirmDialogData({ lead, loading: false });
        setShowConfirmDialog(true);
    };

    async function confirmDelete() {
        if (!confirmDialogData.lead) return;
        const leadId = confirmDialogData.lead.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete lead");
            }
            setConfirmDialogData({ lead: null, loading: false });
            setShowConfirmDialog(false);
            setLeads((prev) => prev.filter((l) => l.id !== leadId));
            setTotalItems((prev) => prev - 1);
            fetchLeads();
            fetchKpis();
            toast.success("Lead deleted");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            "Not Started": "bg-muted text-foreground",
            "In Progress": "bg-status-new-50 text-status-new",
            Qualified: "bg-status-active-50 text-status-active",
            Closed: "bg-status-sold-50 text-status-sold",
            Lost: "bg-status-lost-50 text-status-lost",
        };
        return colors[status] || "bg-muted text-foreground";
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Not Started":
                return <Clock className="h-4 w-4 text-muted-foreground" />;
            case "In Progress":
                return <Loader2 className="h-4 w-4 text-status-new" />;
            case "Qualified":
                return <CheckCircle className="h-4 w-4 text-status-active" />;
            case "Closed":
                return <CheckCircle className="h-4 w-4 text-status-sold" />;
            case "Lost":
                return <XCircle className="h-4 w-4 text-status-lost" />;
            default:
                return null;
        }
    };

    const getSourceColor = (source: string) => {
        const colors: Record<string, string> = {
            Website: "bg-muted text-subtle-foreground",
            Referral: "bg-success-50 text-success",
            Event: "bg-warning-50 text-warning",
            "Walk-in": "bg-primary-50 text-primary",
            Facebook: "bg-muted text-subtle-foreground",
            Craigslist: "bg-muted text-subtle-foreground",
            Kijiji: "bg-muted text-subtle-foreground",
            Phone: "bg-muted text-subtle-foreground",
        };
        return colors[source] || "bg-muted text-subtle-foreground";
    };

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const hasFilters = Boolean(
        debouncedSearch ||
            statusFilter ||
            sourceFilter ||
            temperatureFilter ||
            assigneeFilter ||
            createdAtFrom ||
            createdAtTo
    );
    const emptyKind = resolveListEmptyKind({ hasFilters, forbidden });

    const rowActions = (lead: Lead) => (
        <RowActionsMenu
            primary={
                <button
                    type="button"
                    onClick={() => handleViewDetails(lead)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                    title="View"
                    aria-label={`View ${lead.customer?.name || "lead"}`}
                >
                    <Eye className="h-4 w-4" />
                </button>
            }
            items={[
                ...(canWrite("leads")
                    ? [
                          {
                              label: "Edit",
                              icon: <Edit className="h-3.5 w-3.5" />,
                              onClick: () => handleEdit(lead),
                          },
                      ]
                    : []),
                ...(canDelete("leads")
                    ? [
                          {
                              label: "Delete",
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              tone: "destructive" as const,
                              onClick: () => handleDelete(lead),
                          },
                      ]
                    : []),
            ]}
        />
    );

    return (
        <ListPageShell
            title="Leads"
            description="Sales pipeline and lead engagement"
            icon={Users}
            meta={
                !loading && !error ? (
                    <span className="text-sm text-muted-foreground">
                        {totalItems.toLocaleString()} lead{totalItems === 1 ? "" : "s"}
                        {statusFilter ? ` · ${statusFilter}` : ""}
                    </span>
                ) : undefined
            }
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    {canWrite("leads") && (
                        <Button size="sm" onClick={handleAdd}>
                            <UserPlus className="h-4 w-4" />
                            <span className="hidden sm:inline">Add Lead</span>
                        </Button>
                    )}
                </div>
            }
            kpis={
                <MetricStrip
                    loading={kpiLoading}
                    items={[
                        { label: "Hot", value: kpis.hot, tone: "hot" },
                        { label: "Warm", value: kpis.warm, tone: "warm" },
                        { label: "Cold", value: kpis.cold, tone: "cold" },
                        { label: "Total", value: kpis.total },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search leads…"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    filters={[
                        {
                            id: "status",
                            value: statusFilter,
                            onChange: setStatusFilter,
                            options: STATUS_OPTIONS,
                            allLabel: "All status",
                        },
                        {
                            id: "source",
                            value: sourceFilter,
                            onChange: setSourceFilter,
                            options: SOURCE_OPTIONS,
                            allLabel: "All sources",
                        },
                        {
                            id: "temperature",
                            value: temperatureFilter,
                            onChange: setTemperatureFilter,
                            options: [
                                { value: "Hot", label: "Hot" },
                                { value: "Warm", label: "Warm" },
                                { value: "Cold", label: "Cold" },
                            ],
                            allLabel: "All scores",
                        },
                        ...(locations.length > 0
                            ? [
                                  {
                                      id: "location",
                                      value: locationFilter,
                                      onChange: setLocationFilter,
                                      options: locations.map((loc) => ({
                                          value: loc.id,
                                          label: loc.name,
                                      })),
                                      allLabel: "All locations",
                                  },
                              ]
                            : []),
                        ...(userRole === "Admin" || userRole === "Manager"
                            ? [
                                  {
                                      id: "assignee",
                                      value: assigneeFilter,
                                      onChange: setAssigneeFilter,
                                      options: assignees,
                                      allLabel: "All assignees",
                                  },
                              ]
                            : []),
                    ]}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onExport={exportToExcel}
                    exportLoading={exportLoading}
                    showPrimary={false}
                    extraFilters={
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowMoreFilters(!showMoreFilters)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                                    showMoreFilters || createdAtFrom || createdAtTo
                                        ? "border-primary/30 bg-primary-50 text-primary"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Dates
                                {(createdAtFrom || createdAtTo) && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                            </button>
                            {showMoreFilters && (
                                <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Created date range
                                            </label>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">
                                                        From
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={createdAtFrom}
                                                        onChange={(e) =>
                                                            setCreatedAtFrom(e.target.value)
                                                        }
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 min-h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">
                                                        To
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={createdAtTo}
                                                        onChange={(e) =>
                                                            setCreatedAtTo(e.target.value)
                                                        }
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 min-h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCreatedAtFrom("");
                                                    setCreatedAtTo("");
                                                    setShowMoreFilters(false);
                                                }}
                                                className="flex-1 rounded-lg border border-border px-3 py-2 min-h-10 text-xs text-foreground hover:bg-muted"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowMoreFilters(false)}
                                                className="flex-1 rounded-lg bg-primary px-3 py-2 min-h-10 text-xs text-primary-foreground"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    }
                />
            }
        >
            {viewMode === "table" ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="hidden max-h-[calc(100vh-14rem)] overflow-auto lg:block">
                        <table className="w-full min-w-0 table-fixed text-[13px]">
                            <thead className="sticky top-0 z-[1] border-b border-border bg-card/95 backdrop-blur-sm">
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                                    <th className="min-w-0 truncate px-3.5 py-2.5 font-semibold">Customer</th>
                                    <th className="w-[110px] px-3.5 py-2.5">Source</th>
                                    <th className="w-[120px] px-3.5 py-2.5">Status</th>
                                    <th className="w-[72px] px-3.5 py-2.5">Score</th>
                                    <th className="min-w-0 truncate px-3.5 py-2.5">Vehicle</th>
                                    <th className="min-w-0 truncate px-3.5 py-2.5">Assigned</th>
                                    <th className="w-[120px] px-3.5 py-2.5">Engaged</th>
                                    <th className="w-[88px] px-3.5 py-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="p-6">
                                            <SkeletonTable rows={8} cols={6} />
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={8} className="p-6">
                                            <EmptyState
                                                kind={forbidden ? "permission" : "error"}
                                                title={
                                                    forbidden
                                                        ? "You don't have access"
                                                        : "Couldn't load leads"
                                                }
                                                description={
                                                    forbidden
                                                        ? "Ask your administrator for leads read access."
                                                        : error
                                                }
                                                action={
                                                    forbidden
                                                        ? undefined
                                                        : {
                                                              label: "Try again",
                                                              onClick: () => fetchLeads(),
                                                          }
                                                }
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-6">
                                            <EmptyState
                                                kind={emptyKind}
                                                icon={Users}
                                                title={
                                                    emptyKind === "permission"
                                                        ? "You don't have access"
                                                        : emptyKind === "no-results"
                                                          ? "No leads match"
                                                          : "No leads yet"
                                                }
                                                description={
                                                    emptyKind === "permission"
                                                        ? "Ask your administrator for leads read access."
                                                        : emptyKind === "no-results"
                                                          ? "Try another search or clear filters."
                                                          : canWrite("leads")
                                                            ? "Add a lead, then schedule follow-ups so the floor knows who to call."
                                                            : "No leads yet. Ask an admin for write access to add the first prospect."
                                                }
                                                action={
                                                    canWrite("leads") && emptyKind === "first-use"
                                                        ? {
                                                              label: "Add lead",
                                                              onClick: handleAdd,
                                                              icon: UserPlus,
                                                          }
                                                        : undefined
                                                }
                                                keyboardHint={emptyKind === "first-use"}
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => {
                                        const scored = resolveLeadScore(lead);
                                        return (
                                            <tr
                                                key={lead.id}
                                                role="button"
                                                tabIndex={0}
                                                className="group cursor-pointer border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/50 focus-visible:border-l-primary focus-visible:bg-muted/50 focus-visible:outline-none"
                                                onClick={() => handleViewDetails(lead)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleViewDetails(lead);
                                                }}
                                            >
                                                <td className="min-w-0 overflow-hidden px-3.5 py-2.5">
                                                    <div className="min-w-0">
                                                        <RelationChip
                                                            className="max-w-full"
                                                            customerId={lead.customer_id || lead.customer?.id}
                                                            name={lead.customer?.name}
                                                            avatarUrl={lead.customer?.avatar}
                                                            emptyLabel="Unlinked"
                                                            onOpen={() => handleViewDetails(lead)}
                                                        />
                                                        {lead.customer?.email ? (
                                                            <p className="mt-0.5 min-w-0 truncate pl-7 text-[11px] text-muted-foreground">
                                                                {lead.customer.email}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <span
                                                        className={`inline-block max-w-full truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${getSourceColor(lead.source)}`}
                                                    >
                                                        {lead.source}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                                                        {getStatusIcon(lead.status)}
                                                        <span
                                                            className={`min-w-0 truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${getStatusColor(lead.status)}`}
                                                        >
                                                            {lead.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <span
                                                        className={cn(
                                                            "inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                                                            temperatureClass(scored.temperature)
                                                        )}
                                                        title={`Score ${scored.score}`}
                                                    >
                                                        {scored.temperature}
                                                        <span className="ml-1 text-muted-foreground font-medium">
                                                            {scored.score}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="min-w-0 overflow-hidden px-3.5 py-2.5 text-foreground/90">
                                                    <span className="block min-w-0 truncate">
                                                        {lead.vehicle
                                                            ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
                                                            : "—"}
                                                    </span>
                                                </td>
                                                <td className="min-w-0 overflow-hidden px-3.5 py-2.5">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="shrink-0">
                                                            <Avatar
                                                                name={
                                                                    lead.assigned_user?.full_name ||
                                                                    "Unassigned"
                                                                }
                                                                src={lead.assigned_user?.avatar}
                                                                size="xs"
                                                            />
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate text-foreground/90">
                                                            {lead.assigned_user?.full_name ||
                                                                "Unassigned"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td
                                                    className="px-3.5 py-2.5 tabular-nums text-muted-foreground"
                                                    title={
                                                        lead.last_engagement
                                                            ? new Date(
                                                                  lead.last_engagement
                                                              ).toLocaleString()
                                                            : undefined
                                                    }
                                                >
                                                    {timeAgo(lead.last_engagement)}
                                                </td>
                                                <td className="px-3.5 py-2.5">{rowActions(lead)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="divide-y divide-border lg:hidden">
                        {loading ? (
                            <div className="p-4">
                                <SkeletonTable rows={5} cols={2} />
                            </div>
                        ) : error ? (
                            <EmptyState
                                kind={forbidden ? "permission" : "error"}
                                title={
                                    forbidden ? "You don't have access" : "Couldn't load leads"
                                }
                                description={
                                    forbidden
                                        ? "Ask your administrator for leads read access."
                                        : error
                                }
                                action={
                                    forbidden
                                        ? undefined
                                        : { label: "Try again", onClick: () => fetchLeads() }
                                }
                                className="m-4"
                            />
                        ) : leads.length === 0 ? (
                            <EmptyState
                                kind={emptyKind}
                                icon={Users}
                                title={
                                    emptyKind === "permission"
                                        ? "You don't have access"
                                        : emptyKind === "no-results"
                                          ? "No leads match"
                                          : "No leads yet"
                                }
                                description={
                                    emptyKind === "permission"
                                        ? "Ask your administrator for leads read access."
                                        : emptyKind === "no-results"
                                          ? "Try another search or clear filters."
                                          : canWrite("leads")
                                            ? "Add a lead, then schedule follow-ups so the floor knows who to call."
                                            : "No leads yet. Ask an admin for write access to add the first prospect."
                                }
                                action={
                                    canWrite("leads") && emptyKind === "first-use"
                                        ? { label: "Add lead", onClick: handleAdd, icon: UserPlus }
                                        : undefined
                                }
                                keyboardHint={emptyKind === "first-use"}
                                className="m-4"
                            />
                        ) : (
                            leads.map((lead) => {
                                const scored = resolveLeadScore(lead);
                                return (
                                    <div
                                        key={lead.id}
                                        className="p-4 transition-colors hover:bg-muted/40"
                                    >
                                        <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <span className="shrink-0">
                                                    <Avatar
                                                        name={lead.customer?.name}
                                                        src={lead.customer?.avatar}
                                                        size="md"
                                                    />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {lead.customer?.name || "Unknown"}
                                                    </p>
                                                    {lead.customer?.email && (
                                                        <p className="min-w-0 truncate text-xs text-muted-foreground">
                                                            {lead.customer.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0">{rowActions(lead)}</div>
                                        </div>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSourceColor(lead.source)}`}
                                            >
                                                {lead.source}
                                            </span>
                                            <span
                                                className={cn(
                                                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                                                    temperatureClass(scored.temperature)
                                                )}
                                            >
                                                {scored.temperature}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(lead.status)}
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(lead.status)}`}
                                                >
                                                    {lead.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <div>
                                                <span className="font-medium text-muted-foreground/70">
                                                    Vehicle:
                                                </span>{" "}
                                                {lead.vehicle
                                                    ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
                                                    : "N/A"}
                                            </div>
                                            <div>
                                                <span className="font-medium text-muted-foreground/70">
                                                    Assigned:
                                                </span>{" "}
                                                {lead.assigned_user?.full_name || "Unassigned"}
                                            </div>
                                            <div className="col-span-2">
                                                <span className="font-medium text-muted-foreground/70">
                                                    Last contact:
                                                </span>{" "}
                                                {timeAgo(lead.last_engagement)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {!loading && !error && leads.length > 0 && (
                        <div className="flex items-center justify-between border-t border-border px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                                {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
                                leads
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-lg border border-border p-2 transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm text-foreground/80">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                                    }
                                    disabled={currentPage === totalPages}
                                    className="rounded-lg border border-border p-2 transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <LeadsKanban
                    leads={leads}
                    loading={loading}
                    error={error}
                    onRefresh={fetchLeads}
                    onLeadClick={handleViewDetails}
                    onLeadEdit={handleEdit}
                    onLeadDelete={handleDelete}
                    onAdd={handleAdd}
                    canWrite={canWrite("leads")}
                />
            )}

            {showDetailsModal && selectedLead && (
                <LeadDetailsModal
                    lead={selectedLead}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedLead(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedLead);
                    }}
                    onRefresh={fetchLeads}
                    userRole={userRole}
                    userPermissions={userPermissions}
                />
            )}

            {showFormModal && (
                <LeadFormModal
                    mode={formMode}
                    lead={selectedLead}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedLead(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.lead && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Lead"
                    message="Are you sure you want to delete this lead? This action cannot be undone."
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ lead: null, loading: false });
                    }}
                />
            )}
        </ListPageShell>
    );
}
