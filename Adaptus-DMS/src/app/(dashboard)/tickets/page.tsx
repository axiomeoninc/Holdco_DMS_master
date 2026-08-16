"use client";

import { useState, useEffect } from "react";
import {
    Ticket,
    Plus,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle,
    Clock,
    AlertTriangle,
    XCircle,
    Inbox,
    Mail,
    Phone,
    User,
    Filter
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import TicketFormModal from "@/src/components/TicketFormModal";
import TicketDetailsModal from "@/src/components/TicketDetailsModal";
import TicketsKanban from "@/src/components/TicketsKanban";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { cn } from "@/src/lib/utils";
import type { ListViewMode } from "@/src/components/ListToolbar";

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Ticket {
    id: string;
    subject: string;
    description: string | null;
    assigned_to: string | null;
    created_by: string | null;
    priority: string;
    status: string;
    resolved_at: string | null;
    created_at: string;
    assigned_user: UserData | null;
    created_by_user: UserData | null;
}

interface ApiResponse {
    data: Ticket[];
    count: number;
    limit: number;
    offset: number;
}

const TICKET_STAGES = ["Open", "In Progress", "Resolved", "Closed"];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; icon: LucideIcon }> = {
    "Open": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: AlertCircle },
    "In Progress": { bg: "bg-primary-50", text: "text-blue-700", border: "border-blue-200", icon: Clock },
    "Resolved": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: CheckCircle },
    "Closed": { bg: "bg-muted/40", text: "text-foreground/90", border: "border-border", icon: XCircle }
};

const PRIORITY_COLORS: Record<string, string> = {
    Low: "bg-muted text-foreground/90",
    Medium: "bg-blue-100 text-blue-700",
    High: "bg-orange-100 text-orange-700",
    Urgent: "bg-red-100 text-red-700"
};

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    // More Filters
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [createdAtFrom, setCreatedAtFrom] = useState("");
    const [createdAtTo, setCreatedAtTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(20);
    const [viewMode, setViewMode] = useState<ListViewMode>("kanban");
    const [exportLoading, setExportLoading] = useState(false);

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        ticket: Ticket | null;
        loading: boolean;
    }>({ ticket: null, loading: false });

    useEffect(() => {
        fetchTickets();
    }, [currentPage, debouncedSearch, priorityFilter, statusFilter, createdAtFrom, createdAtTo]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset to first page when search changes
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    async function exportToExcel() {
        setExportLoading(true);
        try {
            const response = await fetch("/api/tickets?limit=10000", {
            });
            if (!response.ok) throw new Error("Failed to fetch tickets for export");

            const data = await response.json();
            const exportData = data.data || [];

            const worksheetData = exportData.map((ticket: Ticket) => ({
                "Subject": ticket.subject || "",
                "Description": ticket.description || "",
                "Priority": ticket.priority || "",
                "Status": ticket.status || "",
                "Created By": ticket.created_by_user?.full_name || "",
                "Assigned To": ticket.assigned_user?.full_name || "",
                "Created At": ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : "",
                "Resolved At": ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString() : ""
            }));

            await downloadXlsx(
                worksheetData,
                "Tickets",
                `tickets-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 30 }, { wch: 40 }, { wch: 12 }, { wch: 15 },
                    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
                ]
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to export tickets")
        } finally {
            setExportLoading(false);
        }
    }

    async function fetchTickets() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/tickets?limit=${itemsPerPage}&offset=${offset}`;
            if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
            if (priorityFilter) url += `&priority=${encodeURIComponent(priorityFilter)}`;
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (createdAtFrom) url += `&created_at_from=${createdAtFrom}`;
            if (createdAtTo) url += `&created_at_to=${createdAtTo}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch tickets");
            }

            const data: ApiResponse = await response.json();
            setTickets(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setShowDetailsModal(true);
    };

    const handleEdit = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedTicket(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedTicket(null);
        fetchTickets();
    };

    async function handleDelete(ticket: Ticket) {
        setConfirmDialogData({ ticket, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.ticket) return;

        const ticketId = confirmDialogData.ticket.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete ticket");
            }

            setConfirmDialogData({ ticket: null, loading: false });
            setShowConfirmDialog(false);
            setTickets((prev) => prev.filter((t) => t.id !== ticketId));
            setTotalItems((prev) => prev - 1);
            fetchTickets();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    async function handleStatusChange(ticket: Ticket, newStatus: string) {
        try {
            const response = await fetch(`/api/tickets/${ticket.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error("Failed to update ticket status");
            }

            fetchTickets();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        }
    }

    const formatDate = (date: string | null) => {
        if (!date) return "No date";
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Group tickets by status for kanban view
    const ticketsByStatus = TICKET_STAGES.reduce((acc, stage) => {
        acc[stage] = tickets.filter((t) => t.status === stage);
        return acc;
    }, {} as Record<string, Ticket[]>);

    // Stats
    const openCount = tickets.filter((t) => t.status === "Open").length;
    const inProgressCount = tickets.filter((t) => t.status === "In Progress").length;
    const resolvedCount = tickets.filter((t) => t.status === "Resolved").length;
    const closedCount = tickets.filter((t) => t.status === "Closed").length;

    return (
        <ListPageShell
            title="Support Tickets"
            description="Manage and track internal support requests"
            icon={Ticket}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="h-4 w-4" />
                        New Ticket
                    </Button>
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Open", value: openCount, tone: "destructive" },
                        { label: "In Progress", value: inProgressCount },
                        { label: "Resolved", value: resolvedCount, tone: "success" },
                        { label: "Closed", value: closedCount, tone: "cold" },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search tickets by subject, description..."
                    searchValue={searchTerm}
                    onSearchChange={(v) => {
                        setSearchTerm(v);
                        setCurrentPage(1);
                    }}
                    filters={[
                        {
                            id: "priority",
                            value: priorityFilter,
                            onChange: (v) => {
                                setPriorityFilter(v);
                                setCurrentPage(1);
                            },
                            options: [
                                { value: "Low", label: "Low" },
                                { value: "Medium", label: "Medium" },
                                { value: "High", label: "High" },
                                { value: "Urgent", label: "Urgent" },
                            ],
                            allLabel: "All Priority",
                        },
                        {
                            id: "status",
                            value: statusFilter,
                            onChange: (v) => {
                                setStatusFilter(v);
                                setCurrentPage(1);
                            },
                            options: [
                                { value: "Open", label: "Open" },
                                { value: "In Progress", label: "In Progress" },
                                { value: "Resolved", label: "Resolved" },
                                { value: "Closed", label: "Closed" },
                            ],
                            allLabel: "All Status",
                        },
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
                                <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Created Date Range
                                            </label>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">From</span>
                                                    <input
                                                        type="date"
                                                        value={createdAtFrom}
                                                        onChange={(e) => setCreatedAtFrom(e.target.value)}
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">To</span>
                                                    <input
                                                        type="date"
                                                        value={createdAtTo}
                                                        onChange={(e) => setCreatedAtTo(e.target.value)}
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
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
                                                className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/40"
                                            >
                                                Clear All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowMoreFilters(false)}
                                                className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary-600"
                                            >
                                                Apply
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
            {/* Loading State */}
            {loading && (
                <div className="overflow-hidden rounded-lg border border-border bg-card p-6">
                    <SkeletonTable rows={6} cols={5} />
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                        <p className="text-destructive text-sm font-medium mb-2">Error loading tickets</p>
                        <p className="text-foreground/80 text-sm">{error}</p>
                        <button
                            onClick={fetchTickets}
                            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-600"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* Kanban View - Desktop only */}
            {!loading && !error && viewMode === "kanban" && (
                <div className="hidden lg:block">
                    <TicketsKanban
                        tickets={tickets}
                        loading={loading}
                        error={error}
                        onRefresh={fetchTickets}
                        onTicketClick={handleViewDetails}
                        onTicketEdit={handleEdit}
                        onTicketDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                    />
                </div>
            )}

            {/* Kanban Mobile Card View */}
            {!loading && !error && viewMode === "kanban" && (
                <div className="lg:hidden">
                    <div className="space-y-4">
                        {tickets.length === 0 ? (
                            <div className="bg-card rounded-xl border border-border p-12 text-center">
                                <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                <p className="mt-2 text-sm text-muted-foreground">No tickets found</p>
                                <button
                                    onClick={handleAdd}
                                    className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                >
                                    Add Your First Ticket
                                </button>
                            </div>
                        ) : (
                            tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
                                    onClick={() => handleViewDetails(ticket)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${STATUS_COLORS[ticket.status].bg}`}>
                                                <Ticket className={`w-5 h-5 ${STATUS_COLORS[ticket.status].text}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground line-clamp-1">
                                                    {ticket.subject}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    #{ticket.id.slice(0, 8)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleViewDetails(ticket); }}
                                                className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                            >
                                                <Eye className="w-4 h-4 text-primary" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(ticket); }}
                                                className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                            >
                                                <Edit className="w-4 h-4 text-amber-500" />
                                            </button>
                                        </div>
                                    </div>
                                    {ticket.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                            {ticket.description}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                                            {ticket.priority}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status].bg} ${STATUS_COLORS[ticket.status].text}`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div>
                                            <span className="font-medium text-muted-foreground">Created:</span>{" "}
                                            {formatDate(ticket.created_at)}
                                        </div>
                                        <div>
                                            <span className="font-medium text-muted-foreground">Assigned:</span>{" "}
                                            {ticket.assigned_user?.full_name || "Unassigned"}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* List View */}
            {!loading && !error && viewMode === "table" && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Desktop Table - Hidden on mobile */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Subject
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Priority
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Assigned To
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                            <p className="mt-2 text-sm text-muted-foreground">No tickets found</p>
                                            <button
                                                onClick={handleAdd}
                                                className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                            >
                                                Add Your First Ticket
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    tickets.map((ticket) => (
                                        <tr
                                            key={ticket.id}
                                            role="button"
                                            tabIndex={0}
                                            className="cursor-pointer border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/50 focus-visible:border-l-primary focus-visible:bg-muted/50 focus-visible:outline-none"
                                            onClick={() => handleViewDetails(ticket)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleViewDetails(ticket);
                                            }}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg ${STATUS_COLORS[ticket.status].bg}`}>
                                                        <Ticket className={`w-4 h-4 ${STATUS_COLORS[ticket.status].text}`} />
                                                    </div>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            className="text-left text-sm font-medium text-primary hover:underline underline-offset-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewDetails(ticket);
                                                            }}
                                                        >
                                                            {ticket.subject}
                                                        </button>
                                                        {ticket.description && (
                                                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                                                {ticket.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                                                    {ticket.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    {(() => {
                                                        const StatusIcon = STATUS_COLORS[ticket.status]?.icon;
                                                        return StatusIcon ? (
                                                            <StatusIcon className={`w-4 h-4 ${STATUS_COLORS[ticket.status].text}`} />
                                                        ) : null;
                                                    })()}
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status].bg} ${STATUS_COLORS[ticket.status].text}`}>
                                                        {ticket.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-foreground/80">
                                                    {formatDate(ticket.created_at)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {ticket.assigned_user?.avatar ? (
                                                        <img
                                                            src={ticket.assigned_user.avatar}
                                                            alt={ticket.assigned_user.full_name}
                                                            className="w-6 h-6 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-white text-xs font-medium">
                                                            {ticket.assigned_user?.full_name?.[0] || "?"}
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-foreground/80">
                                                        {ticket.assigned_user?.full_name || "Unassigned"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewDetails(ticket);
                                                        }}
                                                        className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4 text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(ticket);
                                                        }}
                                                        className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4 text-amber-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(ticket);
                                                        }}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && !error && tickets.length > 0 && (
                        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} tickets
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-foreground/80">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Mobile Cards - Hidden on desktop */}
                    <div className="lg:hidden divide-y divide-border">
                        {tickets.length === 0 ? (
                            <div className="px-4 py-12 text-center">
                                <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                <p className="mt-2 text-sm text-muted-foreground">No tickets found</p>
                                <button
                                    onClick={handleAdd}
                                    className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                >
                                    Add Your First Ticket
                                </button>
                            </div>
                        ) : (
                            tickets.map((ticket) => (
                                <div key={ticket.id} className="p-4 hover:bg-muted/40 transition-colors">
                                    {/* Header Row */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${STATUS_COLORS[ticket.status].bg}`}>
                                                <Ticket className={`w-4 h-4 ${STATUS_COLORS[ticket.status].text}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground line-clamp-1">
                                                    {ticket.subject}
                                                </p>
                                                <span data-testid="mobile-stage-badge" className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[ticket.status]?.bg || "bg-muted"} ${STATUS_COLORS[ticket.status]?.text || "text-foreground"}`}>
                                                    {ticket.status}
                                                </span>
                                                {ticket.description && (
                                                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                                        {ticket.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleViewDetails(ticket)}
                                                className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                            >
                                                <Eye className="w-4 h-4 text-primary" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(ticket)}
                                                className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                            >
                                                <Edit className="w-4 h-4 text-amber-500" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ticket)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Info Row */}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                                            {ticket.priority}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status].bg} ${STATUS_COLORS[ticket.status].text}`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    {/* Details Row */}
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div>
                                            <span className="font-medium text-muted-foreground">Created:</span>{" "}
                                            {formatDate(ticket.created_at)}
                                        </div>
                                        <div>
                                            <span className="font-medium text-muted-foreground">Assigned:</span>{" "}
                                            {ticket.assigned_user?.full_name || "Unassigned"}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Mobile Pagination */}
                    {!loading && !error && tickets.length > 0 && (
                        <div className="lg:hidden px-4 py-3 border-t border-border flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-foreground/80">
                                    {currentPage}/{totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showDetailsModal && selectedTicket && (
                <TicketDetailsModal
                    ticket={selectedTicket}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedTicket(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedTicket);
                    }}
                    onDelete={() => {
                        setShowDetailsModal(false);
                        handleDelete(selectedTicket);
                    }}
                    onStatusChange={handleStatusChange}
                />
            )}

            {showFormModal && (
                <TicketFormModal
                    mode={formMode}
                    ticket={selectedTicket}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedTicket(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.ticket && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Ticket"
                    message={`Are you sure you want to delete "${confirmDialogData.ticket.subject}"? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ ticket: null, loading: false });
                    }}
                />
            )}
        </ListPageShell>
    );
}