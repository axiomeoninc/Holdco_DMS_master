"use client";

import { useState, useEffect } from "react";
import {
    Receipt,
    Plus,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    AlertCircle,
    Calendar,
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    Filter
} from "lucide-react";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import ExpenseDetailsModal from "@/src/components/ExpenseDetailsModal";
import ExpenseFormModal from "@/src/components/ExpenseFormModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { EntityLink } from "@/src/components/ui/EntityLink";
import { cn } from "@/src/lib/utils";

interface Vendor {
    id: string;
    vendor_name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
}

interface Vehicle {
    id: string;
    make: string;
    model: string;
    year: number;
    vin: string;
}

interface UserData {
    id: string;
    full_name: string;
}

interface Expense {
    id: string;
    description: string | null;
    amount: number;
    category: string;
    vendor_id: string | null;
    vehicle_id: string | null;
    expense_date: string;
    due_date: string | null;
    status: string;
    reference_number: string | null;
    notes: string | null;
    tax_amount: number;
    payment_method: string | null;
    created_at: string;
    vendor: Vendor | null;
    vehicle: Vehicle | null;
    entered_by_user: UserData | null;
}

interface ApiResponse {
    data: Expense[];
    count: number;
    limit: number;
    offset: number;
}

const EXPENSE_CATEGORIES = [
    "Vehicle Acquisition",
    "Repair & Maintenance",
    "Parts & Supplies",
    "Utilities",
    "Rent & Lease",
    "Insurance",
    "Marketing",
    "Office Supplies",
    "Professional Services",
    "Travel & Entertainment",
    "Payroll",
    "Taxes & Licenses",
    "Interest & Finance",
    "Miscellaneous",
];

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(10);
    const [exportLoading, setExportLoading] = useState(false);
    const [expenseTotals, setExpenseTotals] = useState({ totalAmount: 0, pendingAmount: 0, paidAmount: 0, overdueCount: 0 });

    // More Filters
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [expenseDateFrom, setExpenseDateFrom] = useState("");
    const [expenseDateTo, setExpenseDateTo] = useState("");

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        expense: Expense | null;
        loading: boolean;
    }>({ expense: null, loading: false });

    // User permissions
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");

    // Permission helpers
    const canWrite = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:write`);
    };

    const canDelete = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:delete`);
    };

    useEffect(() => {
        fetchExpenses();
        fetchUserPermissions();
    }, [currentPage, categoryFilter, statusFilter, debouncedSearch, expenseDateFrom, expenseDateTo]);

    async function fetchUserPermissions() {
        try {
            const response = await fetch("/api/me", {
            });
            if (response.ok) {
                const data = await response.json();
                setUserPermissions(data.data.user_permissions || []);
                setUserRole(data.data.role || "");
            }
        } catch (error) {
            console.error("Error fetching user permissions:", error);
        }
    }

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset to first page when search changes
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const toCsv = (rows: Record<string, string | number>[]) => {
        const cols = Object.keys(rows[0] || {});
        const escape = (v: string | number) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
        return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
    };

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    };

    async function exportToExcel() {
        setExportLoading(true);
        try {

            let exportUrl = "/api/expenses?limit=10000&offset=0";
            if (categoryFilter) exportUrl += `&category=${encodeURIComponent(categoryFilter)}`;
            if (statusFilter) exportUrl += `&status=${encodeURIComponent(statusFilter)}`;
            if (debouncedSearch) exportUrl += `&q=${encodeURIComponent(debouncedSearch)}`;
            if (expenseDateFrom) exportUrl += `&expense_date_from=${expenseDateFrom}`;
            if (expenseDateTo) exportUrl += `&expense_date_to=${expenseDateTo}`;

            const response = await fetch(exportUrl);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch expenses (${response.status})`);
            }

            const data = (await response.json()) as { data: Expense[] };
            const exportData = data.data || [];

            if (exportData.length === 0) {
                throw new Error("No expenses found to export");
            }

            const worksheetData = exportData.map((expense) => ({
                "Date": expense.expense_date ? new Date(expense.expense_date).toLocaleDateString() : "",
                "Category": expense.category || "",
                "Description": expense.description || "",
                "Vendor": expense.vendor?.vendor_name || "",
                "Vehicle": expense.vehicle ? `${expense.vehicle.year} ${expense.vehicle.make} ${expense.vehicle.model}` : "",
                "Amount": expense.amount || 0,
                "Tax Amount": expense.tax_amount || 0,
                "Total": (expense.amount || 0) + (expense.tax_amount || 0),
                "Status": expense.status || "",
                "Due Date": expense.due_date ? new Date(expense.due_date).toLocaleDateString() : "",
                "Reference": expense.reference_number || "",
                "Payment Method": expense.payment_method || "",
                "Notes": expense.notes || ""
            }));

            await downloadXlsx(
                worksheetData,
                "Expenses",
                `expenses-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 },
                    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 },
                ]
            );
            const csvCopied = await copyToClipboard(toCsv(worksheetData));
            toast.success(
                `Exported ${exportData.length} expense${exportData.length === 1 ? "" : "s"}` +
                (csvCopied ? " — CSV copied to clipboard" : "")
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export expenses");
        } finally {
            setExportLoading(false);
        }
    }

    async function fetchExpenses() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/expenses?limit=${itemsPerPage}&offset=${offset}`;
            if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
            if (expenseDateFrom) url += `&expense_date_from=${expenseDateFrom}`;
            if (expenseDateTo) url += `&expense_date_to=${expenseDateTo}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch expenses");
            }

            const data = await response.json();
            setExpenses(data.data);
            setTotalItems(data.count);
            if (data.totals) {
                setExpenseTotals({
                    totalAmount: data.totals.totalAmount || 0,
                    pendingAmount: data.totals.pendingAmount || 0,
                    paidAmount: data.totals.paidAmount || 0,
                    overdueCount: data.totals.overdueCount || 0,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = (expense: Expense) => {
        setSelectedExpense(expense);
        setShowDetailsModal(true);
    };

    const handleEdit = (expense: Expense) => {
        setSelectedExpense(expense);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedExpense(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedExpense(null);
        fetchExpenses();
    };

    async function handleDelete(expense: Expense) {
        setConfirmDialogData({ expense, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.expense) return;

        const expenseId = confirmDialogData.expense.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/expenses/${expenseId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete expense");
            }

            setConfirmDialogData({ expense: null, loading: false });
            setShowConfirmDialog(false);
            setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
            setTotalItems((prev) => prev - 1);
            fetchExpenses();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    async function handleStatusChange(expense: Expense, newStatus: string) {
        try {
            const response = await fetch(`/api/expenses/${expense.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error("Failed to update expense status");
            }

            fetchExpenses();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        }
    }

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            Pending: "bg-yellow-100 text-yellow-700",
            Approved: "bg-blue-100 text-blue-700",
            Paid: "bg-green-100 text-green-700",
            Cancelled: "bg-muted text-foreground/90"
        };
        return colors[status] || "bg-muted text-foreground/90";
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            "Vehicle Acquisition": "bg-purple-100 text-purple-700",
            "Repair & Maintenance": "bg-orange-100 text-orange-700",
            "Parts & Supplies": "bg-blue-100 text-blue-700",
            "Utilities": "bg-cyan-100 text-cyan-700",
            "Rent & Lease": "bg-yellow-100 text-yellow-700",
            "Insurance": "bg-green-100 text-green-700",
            "Marketing": "bg-pink-100 text-pink-700",
            "Office Supplies": "bg-muted text-foreground/90",
            "Professional Services": "bg-indigo-100 text-indigo-700",
            "Travel & Entertainment": "bg-teal-100 text-teal-700",
            "Payroll": "bg-red-100 text-red-700",
            "Taxes & Licenses": "bg-amber-100 text-amber-700",
            "Interest & Finance": "bg-rose-100 text-rose-700",
            "Miscellaneous": "bg-slate-100 text-slate-700"
        };
        return colors[category] || "bg-muted text-foreground/90";
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2
        }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const totalAmount = expenseTotals.totalAmount;
    const pendingAmount = expenseTotals.pendingAmount;
    const paidAmount = expenseTotals.paidAmount;
    const overdueCount = expenseTotals.overdueCount;

    return (
        <ListPageShell
            title="Expenses"
            description="Track and manage business expenses"
            icon={Receipt}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchExpenses} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    {canWrite("expenses") && (
                        <Button size="sm" onClick={handleAdd}>
                            <Plus className="h-4 w-4" />
                            Add Expense
                        </Button>
                    )}
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Total", value: totalAmount, format: "currency" },
                        { label: "Pending", value: pendingAmount, format: "currency", tone: "warning" },
                        { label: "Paid", value: paidAmount, format: "currency", tone: "success" },
                        { label: "Overdue", value: overdueCount, tone: "destructive" },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search expenses..."
                    searchValue={searchTerm}
                    onSearchChange={(v) => {
                        setSearchTerm(v);
                        setCurrentPage(1);
                    }}
                    filters={[
                        {
                            id: "category",
                            value: categoryFilter,
                            onChange: (v) => {
                                setCategoryFilter(v);
                                setCurrentPage(1);
                            },
                            options: EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
                            allLabel: "All Categories",
                        },
                        {
                            id: "status",
                            value: statusFilter,
                            onChange: (v) => {
                                setStatusFilter(v);
                                setCurrentPage(1);
                            },
                            options: [
                                { value: "Pending", label: "Pending" },
                                { value: "Approved", label: "Approved" },
                                { value: "Paid", label: "Paid" },
                                { value: "Cancelled", label: "Cancelled" },
                            ],
                            allLabel: "All Status",
                        },
                    ]}
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
                                    showMoreFilters || expenseDateFrom || expenseDateTo
                                        ? "border-primary/30 bg-primary-50 text-primary"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Dates
                                {(expenseDateFrom || expenseDateTo) && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                            </button>
                            {showMoreFilters && (
                                <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Expense Date Range
                                            </label>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">From</span>
                                                    <input
                                                        type="date"
                                                        value={expenseDateFrom}
                                                        onChange={(e) => {
                                                            setExpenseDateFrom(e.target.value);
                                                            setCurrentPage(1);
                                                        }}
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">To</span>
                                                    <input
                                                        type="date"
                                                        value={expenseDateTo}
                                                        onChange={(e) => {
                                                            setExpenseDateTo(e.target.value);
                                                            setCurrentPage(1);
                                                        }}
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setExpenseDateFrom("");
                                                    setExpenseDateTo("");
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
            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/40 border-b border-border">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Description
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Vendor
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Amount
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-6">
                                        <SkeletonTable rows={8} cols={7} />
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                                        <p className="mt-2 text-sm text-red-600">{error}</p>
                                        <button
                                            onClick={fetchExpenses}
                                            className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                        >
                                            Try Again
                                        </button>
                                    </td>
                                </tr>
                                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <Receipt className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                        <p className="mt-2 text-sm text-muted-foreground">No expenses found</p>
                                        {canWrite("expenses") && (
                                            <button
                                                onClick={handleAdd}
                                                className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                            >
                                                Record Your First Expense
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                expenses.map((expense) => {
                                    const isOverdue = expense.status === "Pending" && expense.due_date && new Date(expense.due_date) < new Date();
                                    return (
                                        <tr
                                            key={expense.id}
                                            role="button"
                                            tabIndex={0}
                                            className={cn(
                                                "cursor-pointer border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/50 focus-visible:border-l-primary focus-visible:bg-muted/50 focus-visible:outline-none",
                                                isOverdue && "bg-red-50/30"
                                            )}
                                            onClick={() => handleViewDetails(expense)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleViewDetails(expense);
                                            }}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className={`text-sm tabular-nums ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                                        {expense.expense_date ? formatDate(expense.expense_date) : "—"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${getCategoryColor(expense.category)}`}>
                                                    {expense.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <EntityLink onClick={() => handleViewDetails(expense)}>
                                                    {expense.description || expense.reference_number || "Expense"}
                                                </EntityLink>
                                                {expense.reference_number && expense.description ? (
                                                    <span className="block text-xs text-muted-foreground">Ref: {expense.reference_number}</span>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                    <span className="text-sm text-foreground/80">
                                                    {expense.vendor?.vendor_name || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-semibold tabular-nums text-foreground">
                                                    {formatCurrency(expense.amount + (expense.tax_amount || 0))}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const statuses = ["Pending", "Approved", "Paid", "Cancelled"];
                                                        const currentIndex = statuses.indexOf(expense.status);
                                                        if (currentIndex < statuses.length - 1) {
                                                            handleStatusChange(expense, statuses[currentIndex + 1]);
                                                        }
                                                    }}
                                                    className={`px-2 py-0.5 text-xs font-medium rounded-md ${getStatusColor(expense.status)} hover:opacity-80 transition-opacity`}
                                                >
                                                    {expense.status}
                                                </button>
                                                {isOverdue && (
                                                    <p className="text-xs text-red-500 mt-1">Overdue</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div
                                                    className="flex items-center justify-end gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(expense)}
                                                        className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4 text-primary" />
                                                    </button>
                                                    {canWrite("expenses") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEdit(expense)}
                                                            className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-4 h-4 text-amber-500" />
                                                        </button>
                                                    )}
                                                    {canDelete("expenses") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(expense)}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </button>
                                                    )}
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
                <div className="lg:hidden divide-y divide-border">
                    {loading ? (
                        <div className="px-4 py-12 text-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                            <p className="mt-2 text-sm text-muted-foreground">Loading expenses...</p>
                        </div>
                    ) : error ? (
                        <div className="px-4 py-12 text-center">
                            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                            <p className="mt-2 text-sm text-red-600">{error}</p>
                            <button
                                onClick={fetchExpenses}
                                className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : expenses.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <Receipt className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                            <p className="mt-2 text-sm text-muted-foreground">No expenses found</p>
                            {canWrite("expenses") && (
                                <button
                                    onClick={handleAdd}
                                    className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                >
                                    Record Your First Expense
                                </button>
                            )}
                        </div>
                    ) : (
                        expenses.map((expense) => {
                            const isOverdue = expense.status === "Pending" && expense.due_date && new Date(expense.due_date) < new Date();
                            return (
                                <div key={expense.id} className="p-4 hover:bg-muted/40 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {expense.description || "No description"}
                                            </p>
                                            {expense.reference_number && (
                                                <p className="text-xs text-muted-foreground">Ref: {expense.reference_number}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleViewDetails(expense)}
                                                className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                            >
                                                <Eye className="w-4 h-4 text-primary" />
                                            </button>
                                            {canWrite("expenses") && (
                                                <button
                                                    onClick={() => handleEdit(expense)}
                                                    className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                >
                                                    <Edit className="w-4 h-4 text-amber-500" />
                                                </button>
                                            )}
                                            {canDelete("expenses") && (
                                                <button
                                                    onClick={() => handleDelete(expense)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(expense.category)}`}>
                                            {expense.category}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                                            {expense.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                                {formatDate(expense.expense_date)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-muted-foreground">Amount:</span>{" "}
                                            <span className="text-foreground font-semibold">
                                                {formatCurrency(expense.amount + (expense.tax_amount || 0))}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-muted-foreground">Vendor:</span> {expense.vendor?.vendor_name || "-"}
                                        </div>
                                        {isOverdue && <p className="text-xs text-red-500">Overdue</p>}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {!loading && !error && expenses.length > 0 && (
                    <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} expenses
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
            </div>

            {/* Modals */}
            {showDetailsModal && selectedExpense && (
                <ExpenseDetailsModal
                    expense={selectedExpense}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedExpense(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedExpense);
                    }}
                    onDelete={() => {
                        setShowDetailsModal(false);
                        handleDelete(selectedExpense);
                    }}
                />
            )}

            {showFormModal && (
                <ExpenseFormModal
                    mode={formMode}
                    expense={selectedExpense}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedExpense(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.expense && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Expense"
                    message={`Are you sure you want to delete this expense? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ expense: null, loading: false });
                    }}
                />
            )}
        </ListPageShell>
    );
}