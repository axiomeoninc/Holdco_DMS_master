"use client";

import { useState, useEffect } from "react";
import {
    Bell,
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    AlertCircle,
    Calendar,
    Clock,
    CheckCircle,
    CalendarDays,
    List,
} from "lucide-react";
import FollowUpDetailsModal from "@/src/components/FollowUpDetailsModal";
import FollowUpFormModal from "@/src/components/FollowUpFormModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";

import { toast } from "@/src/lib/toast";
import { DatePicker } from "@/src/components/ui/date-picker";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
}

interface Lead {
    id: string;
    source: string;
    status: string;
}

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface FollowUpHistory {
    id: string;
    follow_up_id: string;
    edited_by: string;
    action: string;
    previous_description: string | null;
    new_description: string | null;
    previous_status: string | null;
    new_status: string | null;
    created_at: string;
    edited_by_user: UserData | null;
}

interface FollowUp {
    id: string;
    title: string;
    description: string | null;
    customer_id: string | null;
    lead_id: string | null;
    assigned_to: string | null;
    follow_up_date: string;
    follow_up_time: string | null;
    priority: string;
    status: string;
    notes: string | null;
    completed_at: string | null;
    created_at: string;
    customer: Customer | null;
    lead: Lead | null;
    assigned_user: UserData | null;
    history?: FollowUpHistory[];
}

interface ApiResponse {
    data: FollowUp[];
    count: number;
    limit: number;
    offset: number;
}

type ViewMode = "list" | "calendar";
type FilterStatus = "" | "Pending" | "Completed" | "Cancelled" | "Overdue";

export default function FollowUpsPage() {
    const [followUps, setFollowUps] = useState<FollowUp[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<FilterStatus>("");
    // More Filters
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [followUpDateFrom, setFollowUpDateFrom] = useState("");
    const [followUpDateTo, setFollowUpDateTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(10);
    const [viewMode, setViewMode] = useState<ViewMode>("list");

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        followUp: FollowUp | null;
        loading: boolean;
    }>({ followUp: null, loading: false });

    useEffect(() => {
        fetchFollowUps();
    }, [currentPage, statusFilter, searchTerm, followUpDateFrom, followUpDateTo]);

    async function fetchFollowUps() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/follow-ups?limit=${itemsPerPage}&offset=${offset}`;
            if (statusFilter) url += `&status=${statusFilter}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
            if (followUpDateFrom) url += `&follow_up_date_from=${followUpDateFrom}`;
            if (followUpDateTo) url += `&follow_up_date_to=${followUpDateTo}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch follow-ups");
            }

            const data: ApiResponse = await response.json();
            setFollowUps(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    async function handleViewDetails(followUp: FollowUp) {
        try {
            const response = await fetch(`/api/follow-ups/${followUp.id}`, {
            });

            if (!response.ok) throw new Error("Failed to fetch follow-up details");

            const { data } = await response.json();
            setSelectedFollowUp(data);
            setShowDetailsModal(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load follow-up details");
        }
    }

    const handleEdit = (followUp: FollowUp) => {
        setSelectedFollowUp(followUp);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedFollowUp(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedFollowUp(null);
        fetchFollowUps();
    };

    async function handleDelete(followUp: FollowUp) {
        setConfirmDialogData({ followUp, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.followUp) return;

        const followUpId = confirmDialogData.followUp.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/follow-ups/${followUpId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete follow-up");
            }

            setConfirmDialogData({ followUp: null, loading: false });
            setShowConfirmDialog(false);
            setFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
            setTotalItems((prev) => prev - 1);
            fetchFollowUps();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    async function handleStatusChange(followUp: FollowUp, newStatus: string) {
        try {
            const response = await fetch(`/api/follow-ups/${followUp.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error("Failed to update follow-up status");
            }

            fetchFollowUps();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        }
    }

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            Low: "bg-gray-100 text-gray-700",
            Medium: "bg-blue-100 text-blue-700",
            High: "bg-orange-100 text-orange-700",
            Urgent: "bg-red-100 text-red-700"
        };
        return colors[priority] || "bg-gray-100 text-gray-700";
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            Pending: "bg-yellow-100 text-yellow-700",
            Completed: "bg-green-100 text-green-700",
            Cancelled: "bg-gray-100 text-gray-700"
        };
        return colors[status] || "bg-gray-100 text-gray-700";
    };

    const isOverdue = (followUp: FollowUp) => {
        return (
            followUp.status === "Pending" &&
            new Date(followUp.follow_up_date) < new Date()
        );
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const formatTime = (time: string | null) => {
        if (!time) return "";
        const [hours, minutes] = time.split(":");
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Group follow-ups by date for calendar view
    const groupedByDate = followUps.reduce((acc, followUp) => {
        const date = followUp.follow_up_date.split("T")[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(followUp);
        return acc;
    }, {} as Record<string, FollowUp[]>);

    // Get stats
    const pendingCount = followUps.filter((f) => f.status === "Pending").length;
    const overdueCount = followUps.filter((f) => isOverdue(f)).length;
    const completedToday = followUps.filter((f) => {
        if (f.status !== "Completed") return false;
        const today = new Date().toISOString().split("T")[0];
        return f.completed_at && f.completed_at.split("T")[0] === today;
    }).length;

    return (
        <div className="space-y-6 py-10">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Track and manage customer follow-ups
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === "list"
                                    ? "bg-white shadow-sm text-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("calendar")}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar"
                                    ? "bg-white shadow-sm text-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                            title="Calendar View"
                        >
                            <CalendarDays className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={fetchFollowUps}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Follow-up
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                            <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Pending</p>
                            <p className="text-xl font-bold text-gray-900">{pendingCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Overdue</p>
                            <p className="text-xl font-bold text-red-600">{overdueCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Completed Today</p>
                            <p className="text-xl font-bold text-green-600">{completedToday}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">{totalItems}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search follow-ups..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as FilterStatus);
                                setCurrentPage(1);
                            }}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="Overdue">Overdue</option>
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setShowMoreFilters(!showMoreFilters)}
                                className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
                                    showMoreFilters ? "bg-blue-50 border-blue-200 text-blue-600" : "border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                <Filter className="w-4 h-4" />
                                More Filters
                                {(followUpDateFrom || followUpDateTo) && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                )}
                            </button>
                            {showMoreFilters && (
                                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Follow-up Date Range</label>
                                            <div className="flex flex-col gap-2">
                                                <DatePicker
                                                    label="From"
                                                    value={followUpDateFrom}
                                                    onChange={setFollowUpDateFrom}
                                                />
                                                <DatePicker
                                                    label="To"
                                                    value={followUpDateTo}
                                                    onChange={setFollowUpDateTo}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={() => {
                                                    setFollowUpDateFrom("");
                                                    setFollowUpDateTo("");
                                                    setShowMoreFilters(false);
                                                }}
                                                className="flex-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                            >
                                                Clear All
                                            </button>
                                            <button
                                                onClick={() => setShowMoreFilters(false)}
                                                className="flex-1 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* View Content */}
            {viewMode === "list" ? (
                // List View
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Follow-up
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date & Time
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Priority
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Assigned To
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                                            <p className="mt-2 text-sm text-gray-500">Loading follow-ups...</p>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                                            <p className="mt-2 text-sm text-red-600">{error}</p>
                                            <button
                                                onClick={fetchFollowUps}
                                                className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Try Again
                                            </button>
                                        </td>
                                    </tr>
                                ) : followUps.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <Bell className="w-12 h-12 text-gray-300 mx-auto" />
                                            <p className="mt-2 text-sm text-gray-500">No follow-ups found</p>
                                            <button
                                                onClick={handleAdd}
                                                className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Schedule Your First Follow-up
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    followUps.map((followUp) => {
                                        const overdue = isOverdue(followUp);
                                        return (
                                            <tr key={followUp.id} className={`hover:bg-gray-50 transition-colors ${overdue ? "bg-red-50/30" : ""}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-1.5 rounded-lg ${overdue ? "bg-red-100" : "bg-blue-100"}`}>
                                                            <Bell className={`w-4 h-4 ${overdue ? "text-red-600" : "text-blue-600"}`} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {followUp.title}
                                                            </p>
                                                            {followUp.description && (
                                                                <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                                                    {followUp.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                                                            {formatDate(followUp.follow_up_date)}
                                                        </span>
                                                        {followUp.follow_up_time && (
                                                            <span className="text-xs text-gray-500">
                                                                at {formatTime(followUp.follow_up_time)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {overdue && (
                                                        <p className="text-xs text-red-500 mt-1">⚠️ Overdue</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-gray-600">
                                                        {followUp.customer?.name || "-"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(followUp.priority)}`}>
                                                        {followUp.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => {
                                                            const nextStatus = followUp.status === "Pending" ? "Completed" : followUp.status === "Completed" ? "Pending" : followUp.status;
                                                            if (nextStatus !== followUp.status) {
                                                                handleStatusChange(followUp, nextStatus);
                                                            }
                                                        }}
                                                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(followUp.status)} hover:opacity-80 transition-opacity`}
                                                    >
                                                        {followUp.status}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-gray-600">
                                                        {followUp.assigned_user?.full_name || "Unassigned"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handleViewDetails(followUp)}
                                                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-4 h-4 text-blue-500" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(followUp)}
                                                            className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-4 h-4 text-amber-500" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(followUp)}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden divide-y divide-gray-200">
                        {loading ? (
                            <div className="px-4 py-12 text-center">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                                <p className="mt-2 text-sm text-gray-500">Loading follow-ups...</p>
                            </div>
                        ) : error ? (
                            <div className="px-4 py-12 text-center">
                                <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                                <p className="mt-2 text-sm text-red-600">{error}</p>
                                <button
                                    onClick={fetchFollowUps}
                                    className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : followUps.length === 0 ? (
                            <div className="px-4 py-12 text-center">
                                <Bell className="w-12 h-12 text-gray-300 mx-auto" />
                                <p className="mt-2 text-sm text-gray-500">No follow-ups found</p>
                                <button
                                    onClick={handleAdd}
                                    className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Schedule Your First Follow-up
                                </button>
                            </div>
                        ) : (
                            followUps.map((followUp) => {
                                const overdue = isOverdue(followUp);
                                return (
                                    <div key={followUp.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-1.5 rounded-lg ${overdue ? "bg-red-100" : "bg-blue-100"}`}>
                                                    <Bell className={`w-4 h-4 ${overdue ? "text-red-600" : "text-blue-600"}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{followUp.title}</p>
                                                    {followUp.description && (
                                                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{followUp.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleViewDetails(followUp)}
                                                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-4 h-4 text-blue-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(followUp)}
                                                    className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                >
                                                    <Edit className="w-4 h-4 text-amber-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(followUp)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(followUp.priority)}`}>
                                                {followUp.priority}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(followUp.status)}`}>
                                                {followUp.status}
                                            </span>
                                            {overdue && <span className="text-xs text-red-500">Overdue</span>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span className={overdue ? "text-red-600 font-medium" : ""}>
                                                    {formatDate(followUp.follow_up_date)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-400">Customer:</span> {followUp.customer?.name || "-"}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-400">Assigned:</span> {followUp.assigned_user?.full_name || "Unassigned"}
                                            </div>
                                            {followUp.follow_up_time && (
                                                <div>
                                                    <span className="font-medium text-gray-400">Time:</span> {formatTime(followUp.follow_up_time)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    {!loading && !error && followUps.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} follow-ups
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Calendar View
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="space-y-6">
                        {Object.keys(groupedByDate).length === 0 ? (
                            <div className="text-center py-12">
                                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto" />
                                <p className="mt-2 text-sm text-gray-500">No follow-ups scheduled</p>
                            </div>
                        ) : (
                            Object.entries(groupedByDate)
                                .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                                .map(([date, items]) => {
                                    const isToday = date === new Date().toISOString().split("T")[0];
                                    const isPast = new Date(date) < new Date() && !isToday;

                                    return (
                                        <div key={date} className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`px-3 py-1 rounded-lg text-sm font-medium ${isToday
                                                        ? "bg-blue-100 text-blue-700"
                                                        : isPast
                                                            ? "bg-gray-100 text-gray-600"
                                                            : "bg-gray-50 text-gray-700"
                                                    }`}>
                                                    {isToday ? "Today" : formatDate(date)}
                                                </div>
                                                <div className="flex-1 h-px bg-gray-200"></div>
                                                <span className="text-xs text-gray-500">
                                                    {items.length} follow-up{items.length > 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {items.map((followUp) => {
                                                    const overdue = isOverdue(followUp);
                                                    return (
                                                        <div
                                                            key={followUp.id}
                                                            onClick={() => handleViewDetails(followUp)}
                                                            className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${overdue
                                                                    ? "bg-red-50 border-red-200"
                                                                    : followUp.status === "Completed"
                                                                        ? "bg-green-50 border-green-200"
                                                                        : "bg-white border-gray-200"
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-1.5 rounded-lg ${overdue
                                                                            ? "bg-red-100"
                                                                            : followUp.status === "Completed"
                                                                                ? "bg-green-100"
                                                                                : "bg-blue-100"
                                                                        }`}>
                                                                        <Bell className={`w-4 h-4 ${overdue
                                                                                ? "text-red-600"
                                                                                : followUp.status === "Completed"
                                                                                    ? "text-green-600"
                                                                                    : "text-blue-600"
                                                                            }`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-900">
                                                                            {followUp.title}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500">
                                                                            {followUp.customer?.name || "No customer"} • {followUp.assigned_user?.full_name || "Unassigned"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {followUp.follow_up_time && (
                                                                        <span className="text-xs text-gray-500">
                                                                            {formatTime(followUp.follow_up_time)}
                                                                        </span>
                                                                    )}
                                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(followUp.priority)}`}>
                                                                        {followUp.priority}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showDetailsModal && selectedFollowUp && (
                <FollowUpDetailsModal
                    followUp={selectedFollowUp}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedFollowUp(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedFollowUp);
                    }}
                    onDelete={() => {
                        setShowDetailsModal(false);
                        handleDelete(selectedFollowUp);
                    }}
                />
            )}

            {showFormModal && (
                <FollowUpFormModal
                    mode={formMode}
                    followUp={selectedFollowUp}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedFollowUp(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.followUp && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Follow-up"
                    message={`Are you sure you want to delete "${confirmDialogData.followUp.title}"? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ followUp: null, loading: false });
                    }}
                />
            )}
        </div>
    );
}
