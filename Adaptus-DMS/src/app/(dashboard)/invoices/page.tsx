"use client";

import { useState, useEffect } from "react";
import {
    FileText,
    Plus,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    AlertCircle,
    Filter,
    FileDown,
    CreditCard,
} from "lucide-react";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import InvoiceDetailsModal from "@/src/components/InvoiceDetailsModal";
import InvoiceFormModal from "@/src/components/InvoiceFormModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { toast } from "@/src/lib/toast";
import {
    downloadInvoicePdf,
    parseInvoiceLineItems,
    type InvoicePdfPayload,
} from "@/src/lib/invoice-pdf";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { EntityLink } from "@/src/components/ui/EntityLink";
import { RelationChip } from "@/src/components/ui/RelationChip";
import { RowActionsMenu } from "@/src/components/ui/RowActionsMenu";
import {
    ClickableDataTableRow,
    DataTable,
    DataTableBody,
    DataTableHead,
    DataTableHeaderRow,
    DataTableScroll,
    DataTableShell,
    DataTableTd,
    DataTableTdNum,
    DataTableTh,
} from "@/src/components/ui/DataTable";
import { cn } from "@/src/lib/utils";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar?: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
}

interface Invoice {
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    customer_id: string;
    package_name: string | null;
    payment_amount: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    amount_paid?: number | null;
    status: string;
    notes: string | null;
    line_items?: unknown;
    created_at: string;
    customer: Customer | null;
}

interface ApiResponse {
    data: Invoice[];
    count: number;
    limit: number;
    offset: number;
    totals?: {
        pendingAmount: number;
        paidAmount: number;
        overdueAmount: number;
    };
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    // Honor dashboard deep link `/invoices?status=Pending` after mount (avoid SSR mismatch).
    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get("status");
        if (fromUrl) {
            // Deferred so the deep-link filter is applied after the first paint
            // without a synchronous setState inside the effect.
            const t = setTimeout(() => setStatusFilter(fromUrl), 0);
            return () => clearTimeout(t);
        }
    }, []);
    // More Filters
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
    const [invoiceDateTo, setInvoiceDateTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(10);
    const [exportLoading, setExportLoading] = useState(false);
    const [invoiceTotals, setInvoiceTotals] = useState({
        pendingAmount: 0,
        paidAmount: 0,
        overdueAmount: 0,
    });

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        invoice: Invoice | null;
        loading: boolean;
    }>({ invoice: null, loading: false });

    // User permissions
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");

    // Permission helpers
    const canWrite = (resource: string): boolean => {
        if (userRole === "Admin" || userRole === "Manager") return true;
        if (userPermissions.includes("*")) return true;
        return userPermissions.includes(`${resource}:write`);
    };

    const canDelete = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        if (userRole === "Manager" && resource !== "users") return true;
        if (userPermissions.includes("*")) return true;
        return userPermissions.includes(`${resource}:delete`);
    };

    useEffect(() => {
        fetchInvoices();
        fetchUserPermissions();
    }, [currentPage, statusFilter, debouncedSearch, invoiceDateFrom, invoiceDateTo]);

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

    async function exportToExcel() {
        setExportLoading(true);
        try {

            const response = await fetch("/api/invoices?limit=10000", {
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch invoices (${response.status})`);
            }

            const data = await response.json();
            const exportData = data.data || [];

            if (exportData.length === 0) {
                throw new Error("No invoices found to export");
            }

            const worksheetData = exportData.map((invoice: Invoice) => {
                const paid = Number(invoice.amount_paid) || 0;
                const total = Number(invoice.total) || 0;
                return {
                    "Invoice Number": invoice.invoice_number || "",
                    "Customer": invoice.customer?.name || (invoice.customer_id ? "Unlinked" : "Unlinked"),
                    "Package": invoice.package_name || "",
                    "Status": invoice.status || "",
                    "Subtotal": invoice.payment_amount || 0,
                    "Tax Rate": invoice.tax_rate || 0,
                    "Tax Amount": invoice.tax_amount || 0,
                    "Total": total,
                    "Amount Paid": paid,
                    "Balance Due": Math.max(0, total - paid),
                    "Invoice Date": invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : "",
                    "Due Date": invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "",
                    "Notes": invoice.notes || ""
                };
            });

            await downloadXlsx(
                worksheetData,
                "Invoices",
                `invoices-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 12 },
                    { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
                    { wch: 15 }, { wch: 15 }, { wch: 30 },
                ]
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export invoices");
        } finally {
            setExportLoading(false);
        }
    }

    async function fetchInvoices() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/invoices?limit=${itemsPerPage}&offset=${offset}`;
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
            if (invoiceDateFrom) url += `&invoice_date_from=${invoiceDateFrom}`;
            if (invoiceDateTo) url += `&invoice_date_to=${invoiceDateTo}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch invoices");
            }

            const data: ApiResponse = await response.json();
            setInvoices(data.data);
            setTotalItems(data.count);
            if (data.totals) {
                setInvoiceTotals({
                    pendingAmount: data.totals.pendingAmount || 0,
                    paidAmount: data.totals.paidAmount || 0,
                    overdueAmount: data.totals.overdueAmount || 0,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setShowDetailsModal(true);
    };

    const handleEdit = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setFormMode("edit");
        setShowFormModal(true);
    };

    async function handleQuickPdf(invoice: Invoice) {
        try {
            let dealerName: string | null = null;
            let dealerAddress: string | null = null;
            let dealerPhone: string | null = null;
            let dealerEmail: string | null = null;
            let dealerHst: string | null = null;
            let dealerLicence: string | null = null;
            let dealerLogoUrl: string | null = null;
            try {
                const meRes = await fetch("/api/me", { credentials: "include" });
                if (meRes.ok) {
                    const meJson = await meRes.json();
                    const d = meJson?.data?.dealership || meJson?.dealership;
                    if (d) {
                        const settings =
                            d.settings && typeof d.settings === "object"
                                ? (d.settings as Record<string, unknown>)
                                : {};
                        dealerName = d.business_name || d.name || null;
                        dealerAddress = d.business_address || null;
                        dealerPhone = d.business_phone || null;
                        dealerEmail = d.business_email || null;
                        dealerLogoUrl = d.logo_url || null;
                        dealerLicence =
                            (typeof settings.dealer_license === "string"
                                ? settings.dealer_license
                                : null) ||
                            (typeof settings.license_number === "string"
                                ? settings.license_number
                                : null) ||
                            d.dealer_license ||
                            null;
                        dealerHst =
                            (typeof settings.hst_number === "string"
                                ? settings.hst_number
                                : null) ||
                            d.hst_number ||
                            null;
                    }
                }
            } catch {
                // PDF still works without dealer block
            }

            const c = invoice.customer;
            const addr = [c?.address, c?.city, c?.province]
                .filter(Boolean)
                .join(", ");
            const payload: InvoicePdfPayload = {
                invoiceNumber: invoice.invoice_number,
                invoiceDate: invoice.invoice_date,
                dueDate: invoice.due_date,
                status: invoice.status,
                packageName: invoice.package_name,
                notes: invoice.notes,
                paymentInstructions: invoice.notes,
                subtotal: Number(invoice.payment_amount) || 0,
                taxRate: Number(invoice.tax_rate) || 0,
                taxAmount: Number(invoice.tax_amount) || 0,
                total: Number(invoice.total) || 0,
                amountPaid: Number(invoice.amount_paid) || 0,
                customerName: c?.name,
                customerEmail: c?.email,
                customerPhone: c?.phone,
                customerAddress: addr || null,
                dealerName,
                dealerAddress,
                dealerPhone,
                dealerEmail,
                dealerHst,
                dealerLicence,
                dealerLogoUrl,
                lineItems: parseInvoiceLineItems(invoice.line_items),
            };
            await downloadInvoicePdf(payload);
            toast.success("PDF downloaded");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not download PDF"
            );
        }
    }

    const handleAdd = () => {
        setSelectedInvoice(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    /**
     * Built-in payments: open a hosted Stripe Checkout Session for the invoice
     * balance. Honest fail-closed — when payments are not configured the API
     * returns PAYMENTS_NOT_CONFIGURED and nothing is charged.
     */
    async function handleOnlinePay(invoice: Invoice) {
        try {
            const response = await fetch("/api/payments/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reference_type: "invoice",
                    reference_id: invoice.id,
                    success_path: "/invoices",
                    cancel_path: "/invoices",
                }),
            });
            const json = await response.json();
            if (!response.ok) {
                if (json?.code === "PAYMENTS_NOT_CONFIGURED") {
                    toast.error(
                        "Online payments are not configured yet — no charge was made."
                    );
                    return;
                }
                throw new Error(json?.error || "Failed to start payment");
            }
            if (json?.data?.url) {
                window.location.href = json.data.url;
            } else {
                throw new Error("Checkout returned no URL");
            }
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not start payment"
            );
        }
    }

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedInvoice(null);
        fetchInvoices();
    };

    async function handleDelete(invoice: Invoice) {
        setConfirmDialogData({ invoice, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.invoice) return;

        const invoiceId = confirmDialogData.invoice.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: "DELETE",
                headers: {
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete invoice");
            }

            // Clear dialog state
            setConfirmDialogData({ invoice: null, loading: false });
            setShowConfirmDialog(false);

            // Remove from local state immediately for faster UX
            setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
            setTotalItems((prev) => prev - 1);

            // Re-fetch to ensure consistency
            fetchInvoices();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const isOverdue = (invoice: Invoice) => {
        if (invoice.status === "Paid") return false;
        if (!invoice.due_date) return false;
        return new Date(invoice.due_date) < new Date();
    };

    /**
     * Honest payment status derived from money actually applied (amount_paid
     * vs total) rather than the legacy lifecycle status. Legacy "Overdue" and
     * "Cancelled" are preserved when nothing has been paid, so the list keeps
     * surfacing those states alongside the money-based Paid/Partial/Pending.
     */
    const invoicePaymentStatus = (invoice: Invoice): string => {
        const total = Number(invoice.total) || 0;
        const paid = Number(invoice.amount_paid) || 0;
        if (invoice.status === "Cancelled") return "Cancelled";
        if (invoice.status === "Paid" || (total > 0 && paid >= total - 0.009)) {
            return "Paid";
        }
        if (paid > 0) return "Partial";
        if (invoice.status === "Overdue") return "Overdue";
        return "Pending";
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2
        }).format(amount);
    };

    const formatDate = (date: string | null | undefined) => {
        if (!date) return null;
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const renderMutedDate = (date: string | null | undefined, overdue = false) => {
        const formatted = formatDate(date);
        if (!formatted) {
            return <span className="text-muted-foreground">—</span>;
        }
        return (
            <span className={cn("whitespace-nowrap tabular-nums", overdue ? "font-medium text-red-600" : "text-muted-foreground")}>
                {formatted}
                {overdue ? " (Overdue)" : null}
            </span>
        );
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const totalPending = invoiceTotals.pendingAmount;
    const totalPaid = invoiceTotals.paidAmount;
    const totalOverdue = invoiceTotals.overdueAmount;

    return (
        <ListPageShell
            title="Invoices"
            description="Manage invoices and track payments"
            icon={FileText}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    {canWrite("invoices") && (
                        <Button size="sm" onClick={handleAdd}>
                            <Plus className="h-4 w-4" />
                            Create Invoice
                        </Button>
                    )}
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Pending", value: totalPending, format: "currency", tone: "warning" },
                        { label: "Paid", value: totalPaid, format: "currency", tone: "success" },
                        { label: "Overdue", value: totalOverdue, format: "currency", tone: "destructive" },
                        { label: "Total", value: totalItems },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search by invoice number, customer, or description..."
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    filters={[
                        {
                            id: "status",
                            value: statusFilter,
                            onChange: (v) => {
                                setStatusFilter(v);
                                setCurrentPage(1);
                            },
                            options: [
                                { value: "Pending", label: "Pending" },
                                { value: "Paid", label: "Paid" },
                                { value: "Overdue", label: "Overdue" },
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
                                    showMoreFilters || invoiceDateFrom || invoiceDateTo
                                        ? "border-primary/30 bg-primary-50 text-primary"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Dates
                                {(invoiceDateFrom || invoiceDateTo) && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                            </button>
                            {showMoreFilters && (
                                <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Invoice Date Range
                                            </label>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">From</span>
                                                    <input
                                                        type="date"
                                                        value={invoiceDateFrom}
                                                        onChange={(e) => setInvoiceDateFrom(e.target.value)}
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-xs text-muted-foreground">To</span>
                                                    <input
                                                        type="date"
                                                        value={invoiceDateTo}
                                                        onChange={(e) => setInvoiceDateTo(e.target.value)}
                                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setInvoiceDateFrom("");
                                                    setInvoiceDateTo("");
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
            <DataTableShell>
                <div className="hidden lg:block">
                    <DataTableScroll>
                        <DataTable>
                            <DataTableHead>
                                <DataTableHeaderRow>
                                    <DataTableTh>Invoice</DataTableTh>
                                    <DataTableTh>Customer</DataTableTh>
                                    <DataTableTh>Status</DataTableTh>
                                    <DataTableTh className="text-right">Amount</DataTableTh>
                                    <DataTableTh>Invoice Date</DataTableTh>
                                    <DataTableTh>Due Date</DataTableTh>
                                    <DataTableTh className="text-right">Actions</DataTableTh>
                                </DataTableHeaderRow>
                            </DataTableHead>
                            <DataTableBody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-6">
                                            <SkeletonTable rows={8} cols={7} />
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="p-6">
                                            <EmptyState
                                                kind="error"
                                                title="Couldn't load invoices"
                                                description={error}
                                                action={{ label: "Try again", onClick: fetchInvoices }}
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-6">
                                            <EmptyState
                                                kind="no-results"
                                                title="No invoices found"
                                                description="Create an invoice to get started."
                                                action={
                                                    canWrite("invoices")
                                                        ? { label: "Create invoice", onClick: handleAdd, icon: Plus }
                                                        : undefined
                                                }
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    invoices.map((invoice) => {
                                        const overdue = isOverdue(invoice);
                                        const paymentStatus = invoicePaymentStatus(invoice);
                                        return (
                                            <ClickableDataTableRow
                                                key={invoice.id}
                                                onRowClick={() => handleViewDetails(invoice)}
                                            >
                                                <DataTableTd>
                                                    <div className="min-w-0">
                                                        <EntityLink
                                                            onClick={() => handleViewDetails(invoice)}
                                                        >
                                                            {invoice.invoice_number}
                                                        </EntityLink>
                                                        {invoice.package_name ? (
                                                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                                {invoice.package_name}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </DataTableTd>
                                                <DataTableTd className="min-w-0">
                                                    <RelationChip
                                                        customerId={invoice.customer_id || invoice.customer?.id || null}
                                                        name={invoice.customer?.name}
                                                        avatarUrl={invoice.customer?.avatar}
                                                        emptyLabel="Unlinked"
                                                    />
                                                </DataTableTd>
                                                <DataTableTd className="whitespace-nowrap">
                                                    <StatusBadge
                                                        status={paymentStatus}
                                                        resource="invoice"
                                                        kind={paymentStatus === "Partial" ? "warning" : undefined}
                                                    />
                                                </DataTableTd>
                                                <DataTableTdNum className="font-semibold">
                                                    {formatCurrency(invoice.total)}
                                                </DataTableTdNum>
                                                <DataTableTd className="whitespace-nowrap">
                                                    {renderMutedDate(invoice.invoice_date)}
                                                </DataTableTd>
                                                <DataTableTd className="whitespace-nowrap">
                                                    {renderMutedDate(invoice.due_date, overdue)}
                                                </DataTableTd>
                                                <DataTableTd className="text-right">
                                                    <RowActionsMenu
                                                        primary={
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewDetails(invoice);
                                                                }}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-primary-50"
                                                                title="View details"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                        }
                                                        items={[
                                                            {
                                                                label: "Download PDF",
                                                                icon: <FileDown className="h-3.5 w-3.5" />,
                                                                onClick: () => void handleQuickPdf(invoice),
                                                            },
                                                            ...(invoice.status !== "Paid" &&
                                                            invoice.status !== "Cancelled"
                                                                ? [{
                                                                    label: "Pay online",
                                                                    icon: <CreditCard className="h-3.5 w-3.5" />,
                                                                    onClick: () => void handleOnlinePay(invoice),
                                                                }]
                                                                : []),
                                                            ...(canWrite("invoices")
                                                                ? [{
                                                                    label: "Edit",
                                                                    icon: <Edit className="h-3.5 w-3.5" />,
                                                                    onClick: () => handleEdit(invoice),
                                                                }]
                                                                : []),
                                                            ...(canDelete("invoices")
                                                                ? [{
                                                                    label: "Delete",
                                                                    icon: <Trash2 className="h-3.5 w-3.5" />,
                                                                    tone: "destructive" as const,
                                                                    onClick: () => handleDelete(invoice),
                                                                }]
                                                                : []),
                                                        ]}
                                                    />
                                                </DataTableTd>
                                            </ClickableDataTableRow>
                                        );
                                    })
                                )}
                            </DataTableBody>
                        </DataTable>
                    </DataTableScroll>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-border">
                    {loading ? (
                        <div className="px-4 py-12 text-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                            <p className="mt-2 text-sm text-muted-foreground">Loading invoices...</p>
                        </div>
                    ) : error ? (
                        <div className="px-4 py-12 text-center">
                            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                            <p className="mt-2 text-sm text-red-600">{error}</p>
                            <button
                                type="button"
                                onClick={fetchInvoices}
                                className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                            <p className="mt-2 text-sm text-muted-foreground">No invoices found</p>
                            {canWrite("invoices") ? (
                                <button
                                    type="button"
                                    onClick={handleAdd}
                                    className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600"
                                >
                                    Create Your First Invoice
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        invoices.map((invoice) => {
                            const overdue = isOverdue(invoice);
                            const paymentStatus = invoicePaymentStatus(invoice);
                            return (
                                <button
                                    type="button"
                                    key={invoice.id}
                                    className="w-full min-w-0 p-4 text-left hover:bg-muted/50 transition-colors"
                                    onClick={() => handleViewDetails(invoice)}
                                >
                                    <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-primary">
                                                {invoice.invoice_number}
                                            </p>
                                            {invoice.package_name ? (
                                                <p className="truncate text-xs text-muted-foreground max-w-[180px]">
                                                    {invoice.package_name}
                                                </p>
                                            ) : null}
                                        </div>
                                        <StatusBadge
                                            status={paymentStatus}
                                            resource="invoice"
                                            kind={paymentStatus === "Partial" ? "warning" : undefined}
                                        />
                                    </div>
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <RelationChip
                                            customerId={invoice.customer_id || invoice.customer?.id}
                                            name={invoice.customer?.name}
                                            avatarUrl={invoice.customer?.avatar}
                                            emptyLabel="Unlinked"
                                        />
                                        <span className="text-sm font-semibold tabular-nums text-foreground">
                                            {formatCurrency(invoice.total)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div>
                                            <span className="font-medium">Invoice:</span>{" "}
                                            {renderMutedDate(invoice.invoice_date)}
                                        </div>
                                        <div>
                                            <span className="font-medium">Due:</span>{" "}
                                            {renderMutedDate(invoice.due_date, overdue)}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {!loading && !error && invoices.length > 0 && (
                    <div className="flex min-w-0 items-center justify-between overflow-x-auto border-t border-border px-4 py-3">
                        <p className="whitespace-nowrap text-sm text-muted-foreground">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} invoices
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
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
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </DataTableShell>

            {/* Modals */}
            {showDetailsModal && selectedInvoice && (
                <InvoiceDetailsModal
                    invoice={selectedInvoice}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedInvoice(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedInvoice);
                    }}
                    onUpdated={(updated) => {
                        setSelectedInvoice(updated);
                        setInvoices((prev) =>
                            prev.map((row) =>
                                row.id === updated.id ? { ...row, ...updated } : row
                            )
                        );
                    }}
                    userRole={userRole}
                    userPermissions={userPermissions}
                />
            )}

            {showFormModal && (
                <InvoiceFormModal
                    mode={formMode}
                    invoice={selectedInvoice}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedInvoice(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.invoice && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Invoice"
                    message={`Are you sure you want to delete invoice ${confirmDialogData.invoice.invoice_number}?`}
                    confirmText="Delete"
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ invoice: null, loading: false });
                    }}
                />
            )}
        </ListPageShell>
    );
}