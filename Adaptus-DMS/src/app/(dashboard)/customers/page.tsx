"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Users,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    Mail,
    Phone,
    UserPlus,
    GitMerge,
} from "lucide-react";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import CustomerDetailsModal from "@/src/components/CustomerDetailsModal";
import CustomerFormModal from "@/src/components/CustomerFormModal";
import CustomerMergeModal from "@/src/components/CustomerMergeModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { EquityTriggersBanner } from "@/src/components/EquityTriggersBanner";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Avatar } from "@/src/components/ui/Avatar";
import { EntityLink } from "@/src/components/ui/EntityLink";
import {
    DataTable,
    DataTableBody,
    DataTableHead,
    DataTableHeaderRow,
    ClickableDataTableRow,
    DataTableScroll,
    DataTableShell,
    DataTableTd,
    DataTableTh,
    useDeskTable,
    DeskTableSortHeader,
    DeskTableColumnsMenu,
    resolveListEmptyKind,
    type ColumnDef,
    type VisibilityState,
} from "@/src/components/ui/DataTable";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;  // Changed from 'state'
    postal_code: string | null;  // Changed from 'zip'
    status: string;
    notes: string | null;
    avatar: string | null;
    created_at: string;
    updated_at: string;
}

const CUSTOMER_COLUMNS: ColumnDef<Customer, unknown>[] = [
    { id: "customer", header: "Customer", accessorKey: "name", enableHiding: false, enableSorting: true },
    { id: "contact", header: "Contact", enableSorting: false },
    { id: "location", header: "Location", accessorFn: (r) => r.city ?? "", enableSorting: true },
    { id: "joined", header: "Joined", accessorKey: "created_at", enableSorting: true },
    { id: "actions", header: "Actions", enableHiding: false, enableSorting: false },
];


interface ApiResponse {
    data: Customer[];
    count: number;
    limit: number;
    offset: number;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebouncedValue(searchTerm, 300);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [statusOptions, setStatusOptions] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [activeCount, setActiveCount] = useState(0);
    const [itemsPerPage] = useState(20);
    const [exportLoading, setExportLoading] = useState(false);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [forbidden, setForbidden] = useState(false);

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        customer: Customer | null;
        loading: boolean;
    }>({ customer: null, loading: false });

    const [showMergeModal, setShowMergeModal] = useState(false);

    useEffect(() => {
        fetchStatusOptions();
        fetchUserPermissions();
        fetchActiveCount();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter]);

    useEffect(() => {
        fetchCustomers();
    }, [currentPage, statusFilter, debouncedSearch]);

    async function fetchActiveCount() {
        try {
            const response = await fetch("/api/customers?status=Active&limit=1");
            if (response.ok) {
                const data = await response.json();
                setActiveCount(data.count || 0);
            }
        } catch {
            /* non-fatal */
        }
    }

    async function fetchUserPermissions() {
        try {
            const response = await fetch("/api/me", {});
            if (response.ok) {
                const data = await response.json();
                setUserPermissions(data.data.user_permissions || []);
                setUserRole(data.data.role || "");
            }
        } catch (error) {
            console.error("Error fetching user permissions:", error);
        }
    }

    async function fetchStatusOptions() {
        try {
            const response = await fetch("/api/customers?distinct_status=true", {});
            if (response.ok) {
                const data = await response.json();
                setStatusOptions(data.data || []);
            }
        } catch (error) {
            console.error("Error fetching status options:", error);
        }
    }

    async function exportToExcel() {
        setExportLoading(true);
        try {
            // Fetch all customers for export (without pagination)
            const response = await fetch("/api/customers?limit=10000", {});
            if (!response.ok) throw new Error("Failed to fetch customers for export");

            const data = await response.json();
            const exportData = data.data || [];

            // Prepare data for Excel
            const worksheetData = exportData.map((customer: Customer & {
                marketing_consent?: boolean | null;
                sms_consent?: boolean | null;
                marketing_consent_at?: string | null;
                sms_consent_at?: string | null;
            }) => ({
                "Customer Name": customer.name || "",
                "Email": customer.email || "",
                "Phone": customer.phone || "",
                "Address": customer.address || "",
                "City": customer.city || "",
                "Province": customer.province || "",
                "Postal Code": customer.postal_code || "",
                "Status": customer.status || "",
                "Marketing Consent": customer.marketing_consent ? "Yes" : "No",
                "Marketing Consent At": customer.marketing_consent_at
                    ? new Date(customer.marketing_consent_at).toLocaleString()
                    : "",
                "SMS Consent": customer.sms_consent ? "Yes" : "No",
                "SMS Consent At": customer.sms_consent_at
                    ? new Date(customer.sms_consent_at).toLocaleString()
                    : "",
                "Notes": customer.notes || "",
                "Created At": customer.created_at ? new Date(customer.created_at).toLocaleDateString() : ""
            }));

            await downloadXlsx(
                worksheetData,
                "Customers",
                `customers-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 25 },
                    { wch: 30 },
                    { wch: 15 },
                    { wch: 30 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 30 },
                    { wch: 15 },
                ]
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to export customers")
        } finally {
            setExportLoading(false);
        }
    }

    // Check if user has write permission for a resource
    const canWrite = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:write`);
    };

    // Check if user has delete permission for a resource
    const canDelete = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:delete`);
    };

    async function fetchCustomers() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/customers?limit=${itemsPerPage}&offset=${offset}`;
            if (statusFilter) url += `&status=${statusFilter}`;
            if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (response.status === 403) {
                setForbidden(true);
                throw new Error("You don't have access to customers");
            }
            if (!response.ok) {
                setForbidden(false);
                throw new Error("Failed to fetch customers");
            }
            setForbidden(false);

            const data: ApiResponse = await response.json();
            setCustomers(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowDetailsModal(true);
    };

    const handleEdit = (customer: Customer) => {
        setSelectedCustomer(customer);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedCustomer(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedCustomer(null);
        fetchCustomers();
    };

    async function handleDelete(customer: Customer) {
        setConfirmDialogData({ customer, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.customer) return;

        const customerId = confirmDialogData.customer.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/customers/${customerId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete customer");
            }

            // Clear dialog state
            setConfirmDialogData({ customer: null, loading: false });
            setShowConfirmDialog(false);

            // Remove from local state immediately for faster UX
            setCustomers((prev) => prev.filter((c) => c.id !== customerId));
            setTotalItems((prev) => prev - 1);

            // Re-fetch to ensure consistency
            fetchCustomers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const hasFilters = Boolean(debouncedSearch || statusFilter);
    const emptyKind = resolveListEmptyKind({ hasFilters, forbidden });
    const writeOk = userRole === "Admin" || canWrite("customers");

    const table = useDeskTable({
        data: customers,
        columns: CUSTOMER_COLUMNS,
        columnVisibility,
        onColumnVisibilityChange: setColumnVisibility,
        globalFilter: debouncedSearch,
        manualFiltering: true,
        getRowId: (row) => row.id,
    });
    const colVisible = (id: string) => table.getColumn(id)?.getIsVisible() !== false;
    const sortedCustomers = table.getRowModel().rows.map((r) => r.original);
    const colSpan = table.getVisibleLeafColumns().length;

    return (
        <ListPageShell
            title="Customers"
            description="Customer directory and contact details"
            icon={Users}
            meta={
                !loading && !error ? (
                    <span className="text-sm text-muted-foreground">
                        {totalItems.toLocaleString()} customer{totalItems === 1 ? "" : "s"}
                        {statusFilter ? ` · ${statusFilter}` : ""}
                    </span>
                ) : undefined
            }
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    {(userRole === "Admin" || canWrite("customers")) && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowMergeModal(true)}
                            >
                                <GitMerge className="h-4 w-4" />
                                Merge duplicates
                            </Button>
                            <Button size="sm" onClick={handleAdd}>
                                <UserPlus className="h-4 w-4" />
                                Add Customer
                            </Button>
                        </>
                    )}
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Total", value: totalItems },
                        { label: "Active", value: activeCount, tone: "success" },
                        { label: "Statuses", value: statusOptions.length },
                        { label: "On page", value: customers.length },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search name, email, phone…"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    filters={[
                        {
                            id: "status",
                            value: statusFilter,
                            onChange: setStatusFilter,
                            options: statusOptions.map((s) => ({ value: s, label: s })),
                            allLabel: "All status",
                        },
                    ]}
                    onExport={exportToExcel}
                    exportLoading={exportLoading}
                    showPrimary={false}
                >
                    <DeskTableColumnsMenu table={table} />
                </ListToolbar>
            }
        >
            <EquityTriggersBanner
                mode="customers"
                inventoryHref="/inventory?aging=1"
                customersHref="#"
            />
            <DataTableShell>
                <DataTableScroll className="hidden lg:block">
                    <DataTable>
                        <DataTableHead>
                            <DataTableHeaderRow>
                                {colVisible("customer") && table.getColumn("customer") && (
                                    <DataTableTh>
                                        <DeskTableSortHeader column={table.getColumn("customer")!} title="Customer" />
                                    </DataTableTh>
                                )}
                                {colVisible("contact") && <DataTableTh>Contact</DataTableTh>}
                                {colVisible("location") && table.getColumn("location") && (
                                    <DataTableTh>
                                        <DeskTableSortHeader column={table.getColumn("location")!} title="Location" />
                                    </DataTableTh>
                                )}
                                {colVisible("joined") && table.getColumn("joined") && (
                                    <DataTableTh className="w-[100px]">
                                        <DeskTableSortHeader column={table.getColumn("joined")!} title="Joined" />
                                    </DataTableTh>
                                )}
                                {colVisible("actions") && (
                                    <DataTableTh className="w-[104px] text-right">Actions</DataTableTh>
                                )}
                            </DataTableHeaderRow>
                        </DataTableHead>
                        <DataTableBody>
                            {loading ? (
                                <tr>
                                    <td colSpan={colSpan} className="p-6">
                                        <SkeletonTable rows={8} cols={5} />
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={colSpan} className="p-6">
                                        <EmptyState
                                            kind={forbidden ? "permission" : "error"}
                                            title={forbidden ? "You don't have access" : "Couldn’t load customers"}
                                            description={error}
                                            action={
                                                forbidden
                                                    ? undefined
                                                    : { label: "Try again", onClick: () => fetchCustomers() }
                                            }
                                            className="border-0 bg-transparent py-10"
                                        />
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpan} className="p-6">
                                        <EmptyState
                                            kind={emptyKind}
                                            icon={Users}
                                            title={
                                                emptyKind === "permission"
                                                    ? "You don't have access"
                                                    : emptyKind === "no-results"
                                                      ? "No customers match"
                                                      : "No customers yet"
                                            }
                                            description={
                                                emptyKind === "permission"
                                                    ? "Ask your administrator for customers read access."
                                                    : emptyKind === "no-results"
                                                      ? "Try another search or clear the status filter."
                                                      : writeOk
                                                        ? "Add a customer so deals, quotations, and follow-ups have someone to attach to."
                                                        : "No customers yet. Ask an admin for write access to add the first record."
                                            }
                                            action={
                                                writeOk && emptyKind === "first-use"
                                                    ? { label: "Add customer", onClick: handleAdd, icon: UserPlus }
                                                    : undefined
                                            }
                                            keyboardHint={emptyKind === "first-use"}
                                            className="border-0 bg-transparent py-10"
                                        />
                                    </td>
                                </tr>
                            ) : (
                                sortedCustomers.map((customer) => (
                                    <ClickableDataTableRow
                                        key={customer.id}
                                        onRowClick={() => handleViewDetails(customer)}
                                    >
                                        {colVisible("customer") && (
                                            <DataTableTd>
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <span className="shrink-0">
                                                        <Avatar name={customer.name} src={customer.avatar} size="sm" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <EntityLink onClick={() => handleViewDetails(customer)}>
                                                            {customer.name}
                                                        </EntityLink>
                                                        {customer.status && (
                                                            <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
                                                                {customer.status}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </DataTableTd>
                                        )}
                                        {colVisible("contact") && (
                                            <DataTableTd>
                                                <div className="space-y-0.5">
                                                    {customer.email ? (
                                                        <div className="flex min-w-0 items-center gap-1.5">
                                                            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                            <span className="min-w-0 flex-1 truncate text-foreground/85">
                                                                {customer.email}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    {customer.phone ? (
                                                        <div className="flex min-w-0 items-center gap-1.5">
                                                            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                            <span className="min-w-0 flex-1 truncate tabular-nums text-foreground/85">
                                                                {customer.phone}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    {!customer.email && !customer.phone && (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            </DataTableTd>
                                        )}
                                        {colVisible("location") && (
                                            <DataTableTd className="text-foreground/90">
                                                <span className="block min-w-0 truncate">
                                                    {customer.city
                                                        ? `${customer.city}${customer.province ? `, ${customer.province}` : ""}`
                                                        : "—"}
                                                </span>
                                            </DataTableTd>
                                        )}
                                        {colVisible("joined") && (
                                            <DataTableTd className="text-muted-foreground">
                                                {formatDate(customer.created_at)}
                                            </DataTableTd>
                                        )}
                                        {colVisible("actions") && (
                                            <DataTableTd>
                                                <div
                                                    className="flex shrink-0 flex-nowrap items-center justify-end gap-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(customer)}
                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        title="View"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {writeOk && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEdit(customer)}
                                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {(userRole === "Admin" || canDelete("customers")) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(customer)}
                                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-50 hover:text-destructive"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </DataTableTd>
                                        )}
                                    </ClickableDataTableRow>
                                ))
                            )}
                        </DataTableBody>
                    </DataTable>
                </DataTableScroll>

                {/* Mobile Cards */}
                <div className="divide-y divide-border lg:hidden">
                    {loading ? (
                        <div className="px-4 py-16 text-center">
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-foreground/40" />
                            <p className="mt-2 text-sm text-muted-foreground">Loading customers…</p>
                        </div>
                    ) : error ? (
                        <EmptyState
                            kind={forbidden ? "permission" : "error"}
                            title={forbidden ? "You don't have access" : "Couldn’t load customers"}
                            description={error}
                            action={
                                forbidden
                                    ? undefined
                                    : { label: "Try again", onClick: () => fetchCustomers() }
                            }
                            className="m-4"
                        />
                    ) : customers.length === 0 ? (
                        <EmptyState
                            kind={emptyKind}
                            icon={Users}
                            title={
                                emptyKind === "permission"
                                    ? "You don't have access"
                                    : emptyKind === "no-results"
                                      ? "No customers match"
                                      : "No customers yet"
                            }
                            description={
                                emptyKind === "permission"
                                    ? "Ask your administrator for customers read access."
                                    : emptyKind === "no-results"
                                      ? "Try another search or clear the status filter."
                                      : writeOk
                                        ? "Add a customer so deals, quotations, and follow-ups have someone to attach to."
                                        : "No customers yet. Ask an admin for write access to add the first record."
                            }
                            action={
                                writeOk && emptyKind === "first-use"
                                    ? { label: "Add customer", onClick: handleAdd, icon: UserPlus }
                                    : undefined
                            }
                            keyboardHint={emptyKind === "first-use"}
                            className="m-4"
                        />
                    ) : (
                        customers.map((customer) => (
                            <div key={customer.id} className="flex min-w-0 gap-3 p-3 active:bg-muted/40">
                                <span className="shrink-0">
                                    <Avatar name={customer.name} src={customer.avatar} size="sm" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => handleViewDetails(customer)}
                                        className="w-full min-w-0 text-left"
                                    >
                                        <p className="truncate text-sm font-medium text-foreground">
                                            {customer.name}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                            {[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact"}
                                        </p>
                                    </button>
                                    {customer.city && (
                                        <p className="mt-1 min-w-0 truncate text-xs text-muted-foreground">
                                            {customer.city}
                                            {customer.province ? `, ${customer.province}` : ""}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleViewDetails(customer)}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    {(userRole === "Admin" || canWrite("customers")) && (
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(customer)}
                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                    )}
                                    {(userRole === "Admin" || canDelete("customers")) && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(customer)}
                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-50 hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {!loading && !error && customers.length > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + 1}–
                            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="rounded-md border border-border p-2 min-h-10 hover:bg-muted disabled:opacity-40"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="min-w-[4.5rem] text-center text-xs text-muted-foreground">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="rounded-md border border-border p-2 min-h-10 hover:bg-muted disabled:opacity-40"
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </DataTableShell>


            {/* Modals */}
            {showDetailsModal && selectedCustomer && (
                <CustomerDetailsModal
                    customer={selectedCustomer}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedCustomer(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedCustomer);
                    }}
                    userRole={userRole}
                    userPermissions={userPermissions}
                />
            )}

            {showFormModal && (
                <CustomerFormModal
                    mode={formMode}
                    customer={selectedCustomer}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedCustomer(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.customer && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Customer"
                    message={`Are you sure you want to delete ${confirmDialogData.customer.name}? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ customer: null, loading: false });
                    }}
                />
            )}

            <CustomerMergeModal
                open={showMergeModal}
                onClose={() => setShowMergeModal(false)}
                onMerged={() => fetchCustomers()}
            />
        </ListPageShell>
    );
}