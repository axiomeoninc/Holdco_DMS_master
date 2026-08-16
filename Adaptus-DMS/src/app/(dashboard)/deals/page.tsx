"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    Calendar,
    User,
    Car,
    FileSignature,
    UserPlus,
    Calculator,
} from "lucide-react";
import DealDetailsModal from "@/src/components/DealDetailsModal";
import DealFormModal from "@/src/components/DealFormModal";
import DealsKanban from "@/src/components/DealsKanban";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import BillOfSaleModal, { type BillOfSale } from "@/src/components/BillOfSaleModal";
import LinkCustomerQueue from "@/src/components/LinkCustomerQueue";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Button } from "@/src/components/ui/Button";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { EntityLink } from "@/src/components/ui/EntityLink";
import { RelationChip } from "@/src/components/ui/RelationChip";
import {
    DataTable,
    DataTableBody,
    DataTableHead,
    DataTableHeaderRow,
    ClickableDataTableRow,
    DataTableScroll,
    DataTableShell,
    DataTableTd,
    DataTableTdNum,
    DataTableTh,
    useDeskTable,
    DeskTableSortHeader,
    DeskTableColumnsMenu,
    resolveListEmptyKind,
    type ColumnDef,
    type VisibilityState,
} from "@/src/components/ui/DataTable";
import { firstImageUrl } from "@/src/lib/vehicle-image";
import { isDealStagnant } from "@/src/lib/business/lead-score";
import { useLocations } from "@/src/hooks/useLocations";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    retail_price: number;
    status: string;
    condition: string;
    image_gallery?: string[];
}

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
}

interface Salesperson {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Deal {
    id: string;
    vehicle_id: string | null;
    customer_id: string | null;
    deal_status: string;
    finance_term: number | null;
    interest_rate: number | null;
    down_payment: number;
    trade_in_value?: number | null;
    sale_price: number;
    salesperson_id: string | null;
    finance_company: string | null;
    notes: string | null;
    deal_date: string;
    created_at: string;
    vehicle: Vehicle | null;
    customer: Customer | null;
    salesperson: Salesperson | null;
}

const DEAL_COLUMNS: ColumnDef<Deal, unknown>[] = [
    { id: "vehicle", header: "Vehicle", enableHiding: false, enableSorting: false },
    { id: "customer", header: "Customer", accessorFn: (r) => r.customer?.name ?? "", enableSorting: true },
    { id: "status", header: "Status", accessorKey: "deal_status", enableSorting: true },
    { id: "sale", header: "Sale", accessorKey: "sale_price", enableSorting: true },
    { id: "date", header: "Date", accessorKey: "deal_date", enableSorting: true },
    { id: "salesperson", header: "Salesperson", enableSorting: false },
    { id: "actions", header: "Actions", enableHiding: false, enableSorting: false },
];


interface ApiResponse {
    data: Deal[];
    count: number;
    limit: number;
    offset: number;
}

type ViewMode = "table" | "kanban";

const DEAL_STAGES = ["Negotiation", "Down Payment", "Finance", "Paid Off", "Cancelled"];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Negotiation": { bg: "bg-status-pending-50", text: "text-status-pending", border: "border-status-pending/30" },
    "Down Payment": { bg: "bg-status-new-50", text: "text-status-new", border: "border-status-new/30" },
    "Finance": { bg: "bg-muted", text: "text-foreground", border: "border-border" },
    "Paid Off": { bg: "bg-status-won-50", text: "text-status-won", border: "border-status-won/30" },
    "Closed": { bg: "bg-status-sold-50", text: "text-status-sold", border: "border-status-sold/30" },
    "Cancelled": { bg: "bg-status-lost-50", text: "text-status-lost", border: "border-status-lost/30" },
    "Lost": { bg: "bg-status-lost-50", text: "text-status-lost", border: "border-status-lost/30" },
    "Open": { bg: "bg-status-pending-50", text: "text-status-pending", border: "border-status-pending/30" },
    "Pending": { bg: "bg-status-pending-50", text: "text-status-pending", border: "border-status-pending/30" },
};

export default function DealsPage() {
    return (
        <Suspense fallback={<SkeletonTable rows={8} />}>
            <DealsPageInner />
        </Suspense>
    );
}

function DealsPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [locationFilter, setLocationFilter] = useState<string>("");
    const { locations } = useLocations();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);
    const [itemsPerPage] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    // User permissions
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [forbidden, setForbidden] = useState(false);
    const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

    // Permission helpers
    const canWrite = (resource: string): boolean => {
        if (isPlatformAdmin || userRole === "Admin") return true;
        if (userPermissions.includes("*")) return true;
        return userPermissions.includes(`${resource}:write`);
    };

    const canDelete = (resource: string): boolean => {
        if (isPlatformAdmin || userRole === "Admin") return true;
        if (userPermissions.includes("*")) return true;
        return userPermissions.includes(`${resource}:delete`);
    };

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        deal: Deal | null;
        loading: boolean;
    }>({ deal: null, loading: false });

    // Bill of Sale modal state
    const [showBillOfSaleModal, setShowBillOfSaleModal] = useState(false);
    const [selectedDealForBillOfSale, setSelectedDealForBillOfSale] = useState<Deal | null>(null);
    const [billOfSaleModalMode, setBillOfSaleModalMode] = useState<"add" | "edit" | "view">("add");
    const [billOfSaleData, setBillOfSaleData] = useState<BillOfSale | null>(null);
    const [loadingBillOfSale, setLoadingBillOfSale] = useState(false);
    const [showLinkQueue, setShowLinkQueue] = useState(false);
    const [unlinkedCount, setUnlinkedCount] = useState(0);

    useEffect(() => {
        fetchDeals();
        fetchUserPermissions();
        fetchUnlinkedCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, statusFilter, locationFilter, searchTerm, viewMode]);

    // Deep-link: /deals?unlinked=true opens the link queue
    useEffect(() => {
        const flag = searchParams?.get("unlinked");
        if (flag === "true" || flag === "1") {
            setShowLinkQueue(true);
        }
    }, [searchParams]);

    async function fetchUnlinkedCount() {
        try {
            const response = await fetch("/api/deals?unlinked=true&limit=1");
            if (response.ok) {
                const data = await response.json();
                setUnlinkedCount(data.count || 0);
            }
        } catch {
            // non-blocking
        }
    }

    async function fetchUserPermissions() {
        try {
            const response = await fetch("/api/me", {
            });
            if (response.ok) {
                const data = await response.json();
                const perms =
                    data.data.effective_permissions ||
                    data.data.user_permissions ||
                    [];
                setUserPermissions(perms);
                setUserRole(data.data.role || "");
                setIsPlatformAdmin(Boolean(data.data.is_platform_admin));
            }
        } catch (error) {
            console.error("Error fetching user permissions:", error);
        }
    }

    async function fetchDeals() {
        try {
            setLoading(true);
            setError(null);
            // Kanban needs the full pipeline; table stays paginated.
            const limit = viewMode === "kanban" ? 500 : itemsPerPage;
            const offset = viewMode === "kanban" ? 0 : (currentPage - 1) * itemsPerPage;

            let url = `/api/deals?limit=${limit}&offset=${offset}`;
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (locationFilter) url += `&location_id=${encodeURIComponent(locationFilter)}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (response.status === 403) {
                setForbidden(true);
                throw new Error("You don't have access to deals");
            }
            if (!response.ok) {
                setForbidden(false);
                throw new Error("Failed to fetch deals");
            }
            setForbidden(false);

            const data: ApiResponse = await response.json();
            setDeals(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    async function exportToExcel() {
        setExportLoading(true);
        try {

            const response = await fetch("/api/deals?limit=10000", {
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch deals (${response.status})`);
            }

            const data = (await response.json()) as { data: Deal[] };
            const exportData = data.data || [];

            if (exportData.length === 0) {
                throw new Error("No deals found to export");
            }

            const worksheetData = exportData.map((deal) => ({
                "Customer": deal.customer?.name || (deal.customer_id ? "Unlinked" : "Cash"),
                "Email": deal.customer?.email || "",
                "Phone": deal.customer?.phone || "",
                "Vehicle": deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : "",
                "VIN": deal.vehicle?.vin || "",
                "Sale Price": deal.sale_price || 0,
                "Down Payment": deal.down_payment || 0,
                "Finance Term": deal.finance_term || "",
                "Interest Rate": deal.interest_rate || "",
                "Finance Company": deal.finance_company || "",
                "Deal Status": deal.deal_status || "",
                "Salesperson": deal.salesperson?.full_name || "",
                "Notes": deal.notes || "",
                "Deal Date": deal.deal_date ? new Date(deal.deal_date).toLocaleDateString() : ""
            }));

            await downloadXlsx(
                worksheetData,
                "Deals",
                `deals-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 25 },
                    { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
                    { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 },
                ]
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export deals");
        } finally {
            setExportLoading(false);
        }
    }

    const handleViewDetails = (deal: Deal) => {
        router.push(`/deals/${deal.id}`);
    };

    const handleEdit = (deal: Deal) => {
        setSelectedDeal(deal);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        router.push("/deals/new");
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedDeal(null);
        fetchDeals();
    };

    async function handleDelete(deal: Deal) {
        setConfirmDialogData({ deal, loading: false });
        setShowConfirmDialog(true);
    }

    async function handleOpenBillOfSale(deal: Deal) {
        setLoadingBillOfSale(true);
        try {
            // Check if bill of sale exists for this deal
            const response = await fetch(`/api/bill-of-sale?deal_id=${deal.id}`, {
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    // Bill of sale exists - open in edit mode
                    setBillOfSaleData(data.data[0]);
                    setSelectedDealForBillOfSale(deal);
                    setBillOfSaleModalMode("edit");
                    setShowBillOfSaleModal(true);
                } else {
                    // No bill of sale - open in add mode
                    setBillOfSaleData(null);
                    setSelectedDealForBillOfSale(deal);
                    setBillOfSaleModalMode("add");
                    setShowBillOfSaleModal(true);
                }
            }
        } catch (err) {
            console.error("Error fetching bill of sale:", err);
            // Open anyway in add mode
            setBillOfSaleData(null);
            setSelectedDealForBillOfSale(deal);
            setBillOfSaleModalMode("add");
            setShowBillOfSaleModal(true);
        } finally {
            setLoadingBillOfSale(false);
        }
    }

    async function confirmDelete() {
        if (!confirmDialogData.deal) return;

        const dealId = confirmDialogData.deal.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/deals/${dealId}`, {
                method: "DELETE",
                headers: {
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete deal");
            }

            // Clear dialog state
            setConfirmDialogData({ deal: null, loading: false });
            setShowConfirmDialog(false);

            // Remove from local state immediately for faster UX
            setDeals((prev) => prev.filter((d) => d.id !== dealId));
            setTotalItems((prev) => prev - 1);

            // Re-fetch to ensure consistency
            fetchDeals();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    async function handleStatusChange(deal: Deal, newStatus: string) {
        try {
            const response = await fetch(`/api/deals/${deal.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ deal_status: newStatus })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update deal status");
            }

            fetchDeals();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        }
    }

    const getStatusColor = (status: string) => {
        return STATUS_COLORS[status]?.bg.replace("-50", "-100") || "bg-muted";
    };

    const getStatusTextColor = (status: string) => {
        return STATUS_COLORS[status]?.text || "text-foreground/90";
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (date: string | null | undefined) => {
        if (!date) return "—";
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Group deals by kanban column (Closed → Paid Off, etc.)
    const dealsByStatus = DEAL_STAGES.reduce((acc, stage) => {
        acc[stage] = deals.filter((d) => {
            if (stage === "Paid Off")
                return d.deal_status === "Paid Off" || d.deal_status === "Closed";
            if (stage === "Negotiation")
                return (
                    d.deal_status === "Negotiation" ||
                    d.deal_status === "Open" ||
                    d.deal_status === "Pending"
                );
            if (stage === "Cancelled")
                return d.deal_status === "Cancelled" || d.deal_status === "Lost";
            return d.deal_status === stage;
        });
        return acc;
    }, {} as Record<string, Deal[]>);

    const negotiationCount = dealsByStatus["Negotiation"]?.length || 0;
    const stagnantCount = deals.filter((d) => isDealStagnant(d)).length;
    const pipelineValue = deals.reduce((sum, d) => sum + (d.sale_price || 0), 0);

    const hasFilters = Boolean(searchTerm || statusFilter);
    const emptyKind = resolveListEmptyKind({ hasFilters, forbidden });
    const table = useDeskTable({
        data: deals,
        columns: DEAL_COLUMNS,
        columnVisibility,
        onColumnVisibilityChange: setColumnVisibility,
        globalFilter: searchTerm,
        manualFiltering: true,
        getRowId: (row) => row.id,
    });
    const colVisible = (id: string) => table.getColumn(id)?.getIsVisible() !== false;
    const sortedDeals = table.getRowModel().rows.map((r) => r.original);
    const colSpan = table.getVisibleLeafColumns().length;

    return (
        <ListPageShell
            title="Deals"
            description="Sales deals and closing pipeline"
            icon={FileText}
            meta={
                !loading && !error ? (
                    <span className="text-sm text-muted-foreground">
                        {totalItems.toLocaleString()} deal{totalItems === 1 ? "" : "s"}
                        {statusFilter ? ` · ${statusFilter}` : ""}
                    </span>
                ) : undefined
            }
            actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchDeals} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        {canWrite("deals") && unlinkedCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowLinkQueue(true);
                                    router.replace("/deals?unlinked=true");
                                }}
                                className="border-warning/40 text-warning hover:bg-warning-50"
                            >
                                <UserPlus className="h-4 w-4" />
                                Link customers ({unlinkedCount})
                            </Button>
                        )}
                        {canWrite("deals") && (
                            <Button size="sm" onClick={handleAdd}>
                                <Plus className="h-4 w-4" />
                                New Deal
                            </Button>
                        )}
                    </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Total", value: totalItems },
                        { label: "Negotiation", value: negotiationCount, tone: "warning" },
                        { label: "Stagnant", value: stagnantCount, tone: "destructive" },
                        { label: "Page pipeline", value: pipelineValue, format: "currency", tone: "success" },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search vehicle, customer, notes…"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    filters={[
                        {
                            id: "status",
                            value: statusFilter,
                            onChange: setStatusFilter,
                            options: [
                                { value: "Negotiation", label: "Negotiation" },
                                { value: "Down Payment", label: "Down Payment" },
                                { value: "Finance", label: "Finance" },
                                { value: "Paid Off", label: "Paid Off" },
                                { value: "Closed", label: "Closed" },
                                { value: "Cancelled", label: "Cancelled" },
                            ],
                            allLabel: "All status",
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
                    ]}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onExport={exportToExcel}
                    exportLoading={exportLoading}
                    showPrimary={false}
                >
                    <DeskTableColumnsMenu table={table} />
                </ListToolbar>
            }
        >
            {/* View Content */}
            {viewMode === "table" ? (
                <DataTableShell>
                    <DataTableScroll className="hidden lg:block">
                        <DataTable>
                            <DataTableHead>
                                <DataTableHeaderRow>
                                    {colVisible("vehicle") && <DataTableTh>Vehicle</DataTableTh>}
                                    {colVisible("customer") && table.getColumn("customer") && (
                                        <DataTableTh>
                                            <DeskTableSortHeader column={table.getColumn("customer")!} title="Customer" />
                                        </DataTableTh>
                                    )}
                                    {colVisible("status") && table.getColumn("status") && (
                                        <DataTableTh className="w-[120px]">
                                            <DeskTableSortHeader column={table.getColumn("status")!} title="Status" />
                                        </DataTableTh>
                                    )}
                                    {colVisible("sale") && table.getColumn("sale") && (
                                        <DataTableTh className="w-[100px] text-right">
                                            <DeskTableSortHeader column={table.getColumn("sale")!} title="Sale" align="right" />
                                        </DataTableTh>
                                    )}
                                    {colVisible("date") && table.getColumn("date") && (
                                        <DataTableTh className="w-[100px]">
                                            <DeskTableSortHeader column={table.getColumn("date")!} title="Date" />
                                        </DataTableTh>
                                    )}
                                    {colVisible("salesperson") && <DataTableTh>Salesperson</DataTableTh>}
                                    {colVisible("actions") && (
                                        <DataTableTh className="w-[120px] text-right">Actions</DataTableTh>
                                    )}
                                </DataTableHeaderRow>
                            </DataTableHead>
                            <DataTableBody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={colSpan} className="p-6">
                                            <SkeletonTable rows={8} cols={7} />
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={colSpan} className="p-6">
                                            <EmptyState
                                                kind={forbidden ? "permission" : "error"}
                                                title={forbidden ? "You don't have access" : "Couldn't load deals"}
                                                description={error}
                                                action={
                                                    forbidden
                                                        ? undefined
                                                        : { label: "Try again", onClick: () => fetchDeals() }
                                                }
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : deals.length === 0 ? (
                                    <tr>
                                        <td colSpan={colSpan} className="p-6">
                                            <EmptyState
                                                kind={emptyKind}
                                                icon={FileText}
                                                title={
                                                    emptyKind === "permission"
                                                        ? "You don't have access"
                                                        : emptyKind === "no-results"
                                                          ? "No deals match"
                                                          : "No deals yet"
                                                }
                                                description={
                                                    emptyKind === "permission"
                                                        ? "Ask your administrator for deals read access."
                                                        : emptyKind === "no-results"
                                                          ? "Try another search or status filter."
                                                          : canWrite("deals")
                                                            ? "Start a deal when a quotation is accepted. Desking estimates monthly — it is not a lender commit."
                                                            : "No deals yet. Ask an admin for write access to create the first deal."
                                                }
                                                action={
                                                    canWrite("deals") && emptyKind === "first-use"
                                                        ? { label: "New deal", onClick: handleAdd, icon: Plus }
                                                        : undefined
                                                }
                                                keyboardHint={emptyKind === "first-use"}
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    sortedDeals.map((deal) => (
                                        <ClickableDataTableRow
                                            key={deal.id}
                                            onRowClick={() => handleViewDetails(deal)}
                                        >
                                            {colVisible("vehicle") && (
                                            <DataTableTd>
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    {firstImageUrl(deal.vehicle?.image_gallery) ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={firstImageUrl(deal.vehicle?.image_gallery) ?? ""}
                                                            alt=""
                                                            className="h-10 w-14 shrink-0 rounded-md border border-border object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                                                            <Car className="h-4 w-4 text-muted-foreground/60" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <EntityLink onClick={() => handleViewDetails(deal)}>
                                                            {deal.vehicle
                                                                ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                                                : "Unlinked vehicle"}
                                                        </EntityLink>
                                                        <p className="mt-0.5 min-w-0 truncate font-mono text-[11px] tracking-tight text-muted-foreground">
                                                            {deal.vehicle?.vin || "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </DataTableTd>
                                            )}
                                            {colVisible("customer") && (
                                            <DataTableTd>
                                                <RelationChip
                                                    className="max-w-full"
                                                    customerId={deal.customer_id || deal.customer?.id}
                                                    name={deal.customer?.name}
                                                    avatarUrl={deal.customer?.avatar}
                                                    emptyLabel="Cash"
                                                />
                                            </DataTableTd>
                                            )}
                                            {colVisible("status") && (
                                            <DataTableTd>
                                                <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
                                                    <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${getStatusColor(deal.deal_status)} ${getStatusTextColor(deal.deal_status)}`}>
                                                        {deal.deal_status}
                                                    </span>
                                                    {isDealStagnant(deal) && (
                                                        <span
                                                            className="shrink-0 whitespace-nowrap rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700"
                                                            title="No progress in 7+ days"
                                                        >
                                                            Stagnant
                                                        </span>
                                                    )}
                                                </div>
                                            </DataTableTd>
                                            )}
                                            {colVisible("sale") && (
                                            <DataTableTdNum className="font-medium">
                                                {formatCurrency(deal.sale_price)}
                                            </DataTableTdNum>
                                            )}
                                            {colVisible("date") && (
                                            <DataTableTd className="text-muted-foreground">
                                                {formatDate(deal.deal_date)}
                                            </DataTableTd>
                                            )}
                                            {colVisible("salesperson") && (
                                            <DataTableTd className="text-foreground/90">
                                                <span className="block min-w-0 truncate">
                                                    {deal.salesperson?.full_name || "Unassigned"}
                                                </span>
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
                                                        onClick={() => handleOpenBillOfSale(deal)}
                                                        disabled={loadingBillOfSale}
                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                                                        title="Bill of Sale"
                                                    >
                                                        {loadingBillOfSale ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <FileSignature className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const qs = new URLSearchParams();
                                                            qs.set("deal_id", deal.id);
                                                            qs.set("sale_price", String(deal.sale_price || 0));
                                                            qs.set("down_payment", String(deal.down_payment || 0));
                                                            qs.set("trade_in_value", String(deal.trade_in_value || 0));
                                                            if (deal.finance_term) qs.set("term_months", String(deal.finance_term));
                                                            if (deal.interest_rate != null) qs.set("interest_rate", String(deal.interest_rate));
                                                            if (deal.vehicle) {
                                                                qs.set(
                                                                    "vehicle",
                                                                    `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                                                );
                                                            }
                                                            if (deal.customer?.name) qs.set("customer", deal.customer.name);
                                                            router.push(`/finance?${qs.toString()}`);
                                                        }}
                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
                                                        title="Desk F&I"
                                                    >
                                                        <Calculator className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(deal)}
                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        title="View"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {canWrite("deals") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEdit(deal)}
                                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canDelete("deals") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(deal)}
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

                    {/* Mobile Cards - Hidden on desktop */}
                    <div className="lg:hidden divide-y divide-border">
                        {loading ? (
                            <div className="px-4 py-12 text-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                                <p className="mt-2 text-sm text-muted-foreground">Loading deals...</p>
                            </div>
                        ) : error ? (
                            <div className="px-4 py-12 text-center">
                                <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                                <p className="mt-2 text-sm text-destructive">{error}</p>
                                <button
                                    onClick={fetchDeals}
                                    className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : deals.length === 0 ? (
                            <EmptyState
                                kind={emptyKind}
                                icon={FileText}
                                title={
                                    emptyKind === "permission"
                                        ? "You don't have access"
                                        : emptyKind === "no-results"
                                          ? "No deals match"
                                          : "No deals yet"
                                }
                                description={
                                    emptyKind === "permission"
                                        ? "Ask your administrator for deals read access."
                                        : emptyKind === "no-results"
                                          ? "Try another search or status filter."
                                          : canWrite("deals")
                                            ? "Start a deal when a quotation is accepted. Desking estimates monthly — it is not a lender commit."
                                            : "No deals yet. Ask an admin for write access to create the first deal."
                                }
                                action={
                                    canWrite("deals") && emptyKind === "first-use"
                                        ? { label: "New deal", onClick: handleAdd, icon: Plus }
                                        : undefined
                                }
                                keyboardHint={emptyKind === "first-use"}
                                className="m-4"
                            />
                        ) : (
                            deals.map((deal) => (
                                <div key={deal.id} className="p-4 hover:bg-muted/40 transition-colors">
                                    {/* Header Row */}
                                    <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            {firstImageUrl(deal.vehicle?.image_gallery) ? (
                                                <img
                                                    src={firstImageUrl(deal.vehicle?.image_gallery) ?? ""}
                                                    alt={`${deal.vehicle?.make ?? ""} ${deal.vehicle?.model ?? ""}`}
                                                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                    <Car className="h-5 w-5 text-muted-foreground/70" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {deal.vehicle
                                                        ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                                        : "Unknown Vehicle"}
                                                </p>
                                                <p className="min-w-0 truncate text-xs text-muted-foreground">
                                                    {deal.customer?.name || (deal.customer_id ? "Unlinked" : "Cash")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-nowrap items-center gap-2">
                                            <button
                                                onClick={() => handleOpenBillOfSale(deal)}
                                                disabled={loadingBillOfSale}
                                                className="p-1.5 hover:bg-success-50 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {loadingBillOfSale ? (
                                                    <Loader2 className="w-4 h-4 text-success animate-spin" />
                                                ) : (
                                                    <FileSignature className="w-4 h-4 text-success" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleViewDetails(deal)}
                                                className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                            >
                                                <Eye className="w-4 h-4 text-primary" />
                                            </button>
                                            {canWrite("deals") && (
                                                <button
                                                    onClick={() => handleEdit(deal)}
                                                    className="p-1.5 hover:bg-warning-50 rounded-lg transition-colors"
                                                >
                                                    <Edit className="w-4 h-4 text-warning" />
                                                </button>
                                            )}
                                            {canDelete("deals") && (
                                                <button
                                                    onClick={() => handleDelete(deal)}
                                                    className="p-1.5 hover:bg-destructive-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Status and Price Row */}
                                    <div className="mb-2 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
                                        <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(deal.deal_status)} ${getStatusTextColor(deal.deal_status)}`}>
                                            {deal.deal_status}
                                        </span>
                                        <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-success">
                                            {formatCurrency(deal.sale_price)}
                                        </span>
                                    </div>
                                    {/* Details Grid */}
                                    <div className="grid min-w-0 grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div className="min-w-0 truncate">
                                            <span className="font-medium text-muted-foreground/70">VIN:</span>{" "}
                                            {deal.vehicle?.vin || "N/A"}
                                        </div>
                                        <div className="min-w-0 truncate">
                                            <span className="font-medium text-muted-foreground/70">Salesperson:</span>{" "}
                                            {deal.salesperson?.full_name || "Unassigned"}
                                        </div>
                                        <div>
                                            <span className="font-medium text-muted-foreground/70">Deal Date:</span>{" "}
                                            {formatDate(deal.deal_date)}
                                        </div>
                                        {deal.down_payment > 0 && (
                                            <div>
                                                <span className="font-medium text-muted-foreground/70">Down Payment:</span>{" "}
                                                {formatCurrency(deal.down_payment)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination */}
                    {!loading && !error && deals.length > 0 && (
                        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} deals
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
            </DataTableShell>
            ) : (
                <DealsKanban
                    deals={deals}
                    loading={loading}
                    error={error}
                    onRefresh={fetchDeals}
                    onAdd={canWrite("deals") ? handleAdd : undefined}
                    canWrite={canWrite("deals")}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                />
            )}

            {/* Modals */}
            {showDetailsModal && selectedDeal && (
                <DealDetailsModal
                    deal={selectedDeal}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedDeal(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedDeal);
                    }}
                    onBillOfSale={() => {
                        const deal = selectedDeal;
                        setShowDetailsModal(false);
                        void handleOpenBillOfSale(deal);
                    }}
                    billOfSaleLoading={loadingBillOfSale}
                />
            )}

            {showFormModal && (
                <DealFormModal
                    mode={formMode}
                    deal={selectedDeal}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedDeal(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.deal && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Deal"
                    message={`Are you sure you want to delete this deal?\n${confirmDialogData.deal.vehicle?.year} ${confirmDialogData.deal.vehicle?.make} ${confirmDialogData.deal.vehicle?.model}`}
                    confirmText="Delete"
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ deal: null, loading: false });
                    }}
                />
            )}

            {showBillOfSaleModal && selectedDealForBillOfSale && (
                <BillOfSaleModal
                    mode={billOfSaleModalMode}
                    deal={selectedDealForBillOfSale}
                    billOfSale={billOfSaleData}
                    onClose={() => {
                        setShowBillOfSaleModal(false);
                        setSelectedDealForBillOfSale(null);
                        setBillOfSaleData(null);
                    }}
                    onSuccess={() => {
                        setShowBillOfSaleModal(false);
                        setSelectedDealForBillOfSale(null);
                        setBillOfSaleData(null);
                        fetchDeals();
                    }}
                />
            )}

            <LinkCustomerQueue
                open={showLinkQueue}
                onClose={() => {
                    setShowLinkQueue(false);
                    if (searchParams?.get("unlinked")) {
                        router.replace("/deals");
                    }
                }}
                onLinked={() => {
                    fetchDeals();
                    fetchUnlinkedCount();
                }}
            />
        </ListPageShell>
    );
}
