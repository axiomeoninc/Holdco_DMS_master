"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Car,
    Plus,
    Search,
    Download,
    RefreshCw,
    Loader2,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    FileText,
    LayoutGrid,
    List,
    SlidersHorizontal,
    Printer,
    X,
} from "lucide-react";
import VehicleImage from "@/src/components/VehicleImage";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { ListPageShell } from "@/src/components/ListPageShell";
import { EquityTriggersBanner } from "@/src/components/EquityTriggersBanner";
import { resolveGallery } from "@/src/lib/vehicle-image";
import { calcEstimatedIncome, daysInStock } from "@/src/lib/estimated-income";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { RowActionsMenu } from "@/src/components/ui/RowActionsMenu";
import { FilterChip, FilterChipGroup, SegmentedControl } from "@/src/components/ui/FilterChip";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { AiNotConfiguredBanner } from "@/src/components/ai/AiNotConfiguredBanner";
import { useLocations } from "@/src/hooks/useLocations";
import { apiFetch, ApiError } from "@/src/lib/fetch";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/src/components/ui/drawer";
import { VirtualList } from "@/src/components/ui/virtual-list";
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
    dataTableTdMutedNumClass,
    dataTableVinClass,
    useDeskTable,
    DeskTableSortHeader,
    DeskTableColumnsMenu,
    resolveListEmptyKind,
    sortingToServer,
    serverToSorting,
    type ColumnDef,
    type VisibilityState,
} from "@/src/components/ui/DataTable";
import { EntityLink } from "@/src/components/ui/EntityLink";
import { cn } from "@/src/lib/utils";
import { printWindowSticker } from "@/src/lib/window-sticker";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    odometer: number;
    stock_number: string | null;
    condition: string;
    status: string;
    purchase_price: number;
    retail_price: number;
    extra_costs: number;
    taxes: number;
    image_gallery: string[];
    images?: string | string[] | null;
    carfax_report_url?: string;
    created_at: string;
    updated_at: string;
}

interface ApiResponse {
    data: Vehicle[];
    count: number;
    limit: number;
    offset: number;
}

interface AdvFilters {
    make: string;
    minYear: string;
    maxYear: string;
    minPrice: string;
    maxPrice: string;
    condition: string;
    locationId: string;
}

const EMPTY_ADV: AdvFilters = {
    make: "",
    minYear: "",
    maxYear: "",
    minPrice: "",
    maxPrice: "",
    condition: "",
    locationId: "",
};

const STATUS_TABS: { value: string; label: string }[] = [
    { value: "Active", label: "Active" },
    { value: "Sold", label: "Sold" },
    { value: "", label: "All" },
    { value: "Coming Soon", label: "Coming Soon" },
    { value: "Inactive", label: "Inactive" },
];

const BULK_STATUSES = ["Active", "Sold", "Coming Soon", "Inactive", "Pending"] as const;

/** Aging threshold (days in stock) for decision metric — live Active units only. */
const AGING_DAYS = 45;

type SortKey = "days" | "retail" | "cost" | "created_at";

const INVENTORY_COLUMNS: ColumnDef<Vehicle, unknown>[] = [
    { id: "select", header: "Select", enableHiding: false, enableSorting: false },
    { id: "photo", header: "Photo", enableSorting: false },
    { id: "vehicle", header: "Vehicle", enableHiding: false, enableSorting: false },
    { id: "stock", header: "Stock", enableSorting: false },
    { id: "status", header: "Status", enableSorting: false },
    { id: "cost", header: "Cost", accessorKey: "purchase_price", enableSorting: true },
    { id: "retail", header: "Retail", accessorKey: "retail_price", enableSorting: true },
    { id: "est_income", header: "Est. income", enableSorting: false },
    { id: "days", header: "Days", enableSorting: true },
    { id: "cfx", header: "CFX", enableSorting: false },
    { id: "actions", header: "Actions", enableHiding: false, enableSorting: false },
];


function buildVehicleQuery(params: {
    limit: number;
    offset?: number;
    status?: string;
    q?: string;
    adv: AdvFilters;
    agingOnly: boolean;
    sortBy: SortKey;
    sortDir: "asc" | "desc";
}): string {
    const sp = new URLSearchParams();
    sp.set("limit", String(params.limit));
    if (params.offset != null) sp.set("offset", String(params.offset));
    if (params.status) sp.set("status", params.status);
    if (params.q) sp.set("q", params.q);
    if (params.adv.make.trim()) sp.set("make", params.adv.make.trim());
    if (params.adv.minYear) sp.set("minYear", params.adv.minYear);
    if (params.adv.maxYear) sp.set("maxYear", params.adv.maxYear);
    if (params.adv.minPrice) sp.set("minPrice", params.adv.minPrice);
    if (params.adv.maxPrice) sp.set("maxPrice", params.adv.maxPrice);
    if (params.adv.condition) sp.set("condition", params.adv.condition);
    if (params.adv.locationId) sp.set("location_id", params.adv.locationId);
    if (params.agingOnly) {
        sp.set("status", "Active");
        sp.set("minDays", String(AGING_DAYS));
    }
    sp.set("sortBy", params.sortBy);
    sp.set("sortDir", params.sortDir);
    return `/api/vehicles?${sp.toString()}`;
}

export default function InventoryPage() {
    const router = useRouter();
    const { locations } = useLocations();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("Active");
    const [advDraft, setAdvDraft] = useState<AdvFilters>(EMPTY_ADV);
    const [advApplied, setAdvApplied] = useState<AdvFilters>(EMPTY_ADV);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [agingOnly, setAgingOnly] = useState(false);
    const [sortBy, setSortBy] = useState<SortKey>("created_at");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [forbidden, setForbidden] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);
    const [atFeedLoading, setAtFeedLoading] = useState(false);
    const [itemsPerPage] = useState(20);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
    const [kpiLoading, setKpiLoading] = useState(true);
    const [kpis, setKpis] = useState({ active: 0, sold: 0, aging: 0, total: 0 });
    const [viewMode, setViewMode] = useState<"table" | "grid">(() => {
        if (typeof window === "undefined") return "table";
        try {
            const v = localStorage.getItem("adaptus:inventory-view");
            return v === "grid" || v === "table" ? v : "table";
        } catch {
            return "table";
        }
    });
    const [nlQuery, setNlQuery] = useState("");
    const [nlBusy, setNlBusy] = useState(false);
    const [nlMissing, setNlMissing] = useState(false);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        vehicle: Vehicle | null;
        loading: boolean;
    }>({ vehicle: null, loading: false });
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    async function fetchUserPermissions() {
        try {
            const response = await fetch("/api/me");
            if (response.ok) {
                const data = await response.json();
                setUserPermissions(data.data.user_permissions || []);
                setUserRole(data.data.role || "");
                setIsPlatformAdmin(Boolean(data.data.is_platform_admin));
            }
        } catch (err) {
            console.error("Error fetching user permissions:", err);
        }
    }

    useEffect(() => {
        void fetchUserPermissions();
    }, []);

    const canWrite = (resource: string): boolean => {
        if (isPlatformAdmin || userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:write`);
    };

    const canDelete = (resource: string): boolean => {
        if (isPlatformAdmin || userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:delete`);
    };

    const listQueryArgs = useMemo(
        () => ({
            status: agingOnly ? "Active" : statusFilter,
            q: debouncedSearch,
            adv: advApplied,
            agingOnly,
            sortBy,
            sortDir,
        }),
        [agingOnly, statusFilter, debouncedSearch, advApplied, sortBy, sortDir]
    );

    const fetchVehicles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;
            const url = buildVehicleQuery({
                limit: itemsPerPage,
                offset,
                ...listQueryArgs,
            });

            const response = await fetch(url);
            if (response.status === 403) {
                setForbidden(true);
                throw new Error("You don't have access to inventory");
            }
            if (!response.ok) {
                setForbidden(false);
                throw new Error("Failed to fetch vehicles");
            }
            setForbidden(false);

            const data: ApiResponse = await response.json();
            setVehicles(data.data);
            setTotalItems(data.count);
            setSelectedIds((prev) => {
                const next = new Set<string>();
                for (const id of prev) {
                    if (data.data.some((v) => v.id === id)) next.add(id);
                }
                return next;
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, listQueryArgs]);

    const fetchKpis = useCallback(async () => {
        try {
            setKpiLoading(true);
            const [activeRes, soldRes, totalRes, agingRes] = await Promise.all([
                fetch("/api/vehicles?limit=1&status=Active"),
                fetch("/api/vehicles?limit=1&status=Sold"),
                fetch("/api/vehicles?limit=1"),
                fetch(`/api/vehicles?limit=1&status=Active&minDays=${AGING_DAYS}`),
            ]);
            const activeJson = activeRes.ok ? await activeRes.json() : null;
            const soldJson = soldRes.ok ? await soldRes.json() : null;
            const totalJson = totalRes.ok ? await totalRes.json() : null;
            const agingJson = agingRes.ok ? await agingRes.json() : null;

            setKpis({
                active: activeJson?.count ?? 0,
                sold: soldJson?.count ?? 0,
                aging: agingJson?.count ?? 0,
                total: totalJson?.count ?? 0,
            });
        } catch (err) {
            console.error("KPI fetch failed:", err);
        } finally {
            setKpiLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    useEffect(() => {
        fetchKpis();
    }, [fetchKpis]);

    const sorting = useMemo(
        () => serverToSorting(sortBy, sortDir),
        [sortBy, sortDir]
    );

    const table = useDeskTable({
        data: vehicles,
        columns: INVENTORY_COLUMNS,
        sorting,
        onSortingChange: (updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            const mapped = sortingToServer(next, "created_at");
            const key = mapped.sortBy as SortKey;
            if (key === "cost" || key === "retail" || key === "days" || key === "created_at") {
                setSortBy(key);
                setSortDir(mapped.sortDir);
                setCurrentPage(1);
            }
        },
        columnVisibility,
        onColumnVisibilityChange: setColumnVisibility,
        globalFilter: debouncedSearch,
        manualSorting: true,
        manualFiltering: true,
        getRowId: (row) => row.id,
    });

    const colVisible = (id: string) => table.getColumn(id)?.getIsVisible() !== false;

    const applyAdvanced = () => {
        setAdvApplied(advDraft);
        setCurrentPage(1);
        setShowAdvanced(false);
    };

    const clearAdvanced = () => {
        setAdvDraft(EMPTY_ADV);
        setAdvApplied(EMPTY_ADV);
        setAgingOnly(false);
        setCurrentPage(1);
    };

    async function runNlSearch() {
        const q = nlQuery.trim() || searchTerm.trim();
        if (!q) {
            toast.error("Enter a natural-language search first");
            return;
        }
        setNlBusy(true);
        setNlMissing(false);
        try {
            const res = await apiFetch<{
                data: {
                    filters: {
                        q?: string;
                        make?: string;
                        model?: string;
                        status?: string;
                        min_price?: number;
                        max_price?: number;
                        min_year?: number;
                        max_year?: number;
                        aging_only?: boolean;
                        min_days_in_stock?: number;
                    };
                    explanation?: string | null;
                };
            }>("/api/ai/inventory-search", {
                method: "POST",
                body: { query: q },
                silent: true,
            });
            const f = res.data.filters;
            if (f.q) setSearchTerm(f.q);
            if (f.status) {
                setAgingOnly(false);
                setStatusFilter(f.status);
            }
            if (f.aging_only || (f.min_days_in_stock && f.min_days_in_stock >= 45)) {
                setAgingOnly(true);
                setStatusFilter("Active");
            }
            setAdvDraft((prev) => ({
                ...prev,
                make: f.make || prev.make,
                minYear: f.min_year != null ? String(f.min_year) : prev.minYear,
                maxYear: f.max_year != null ? String(f.max_year) : prev.maxYear,
                minPrice: f.min_price != null ? String(f.min_price) : prev.minPrice,
                maxPrice: f.max_price != null ? String(f.max_price) : prev.maxPrice,
            }));
            setAdvApplied((prev) => ({
                ...prev,
                make: f.make || prev.make,
                minYear: f.min_year != null ? String(f.min_year) : prev.minYear,
                maxYear: f.max_year != null ? String(f.max_year) : prev.maxYear,
                minPrice: f.min_price != null ? String(f.min_price) : prev.minPrice,
                maxPrice: f.max_price != null ? String(f.max_price) : prev.maxPrice,
            }));
            setCurrentPage(1);
            toast.success(
                "Filters applied",
                res.data.explanation || "Review results — Flash AI draft filters only."
            );
        } catch (err) {
            if (err instanceof ApiError && err.status === 503) {
                setNlMissing(true);
                return;
            }
            toast.error(err instanceof Error ? err.message : "NL search failed");
        } finally {
            setNlBusy(false);
        }
    }

    const advActiveCount = useMemo(() => {
        let n = 0;
        if (advApplied.make.trim()) n += 1;
        if (advApplied.minYear) n += 1;
        if (advApplied.maxYear) n += 1;
        if (advApplied.minPrice) n += 1;
        if (advApplied.maxPrice) n += 1;
        if (advApplied.condition) n += 1;
        if (agingOnly) n += 1;
        return n;
    }, [advApplied, agingOnly]);

    const exportAutoTraderFeed = async (ids?: string[]) => {
        try {
            setAtFeedLoading(true);
            const statusQ = agingOnly
                ? "Active"
                : statusFilter
                  ? encodeURIComponent(statusFilter)
                  : "all";
            let url = `/api/vehicles/syndication?board=autotrader&format=feed&status=${statusQ}`;
            if (ids && ids.length > 0) {
                url += `&ids=${ids.map(encodeURIComponent).join(",")}`;
            }
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    meta?: { included?: number; skipped?: number };
                };
                const skipped = body.meta?.skipped;
                const detail =
                    body.error ||
                    "AutoTrader feed export failed — check price/photos/VIN on Active units";
                throw new Error(
                    skipped != null && skipped > 0
                        ? `${detail} (${skipped} skipped)`
                        : detail
                );
            }
            const text = await res.text();
            const included = res.headers.get("X-Syndication-Included") || "?";
            const skipped = res.headers.get("X-Syndication-Skipped") || "0";
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `autotrader-ca-batch-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success(
                `AT.ca feed downloaded (${included} included${
                    skipped !== "0" ? `, ${skipped} skipped` : ""
                })`
            );
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "AT.ca feed export failed"
            );
        } finally {
            setAtFeedLoading(false);
        }
    };

    async function exportToExcel() {
        setExportLoading(true);
        try {
            const url = buildVehicleQuery({
                limit: 10000,
                offset: 0,
                ...listQueryArgs,
            });
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch vehicles (${response.status})`);
            }

            const data = await response.json();
            const exportData = data.data || [];

            if (exportData.length === 0) {
                throw new Error("No vehicles found to export");
            }

            const worksheetData = exportData.map(
                (vehicle: Vehicle & { exterior_color?: string; interior_color?: string; description?: string }) => {
                    const days = daysInStock(vehicle.created_at);
                    const estIncome = calcEstimatedIncome({
                        retail: vehicle.retail_price,
                        purchase: vehicle.purchase_price,
                        extraCosts: vehicle.extra_costs,
                        taxes: vehicle.taxes,
                    });
                    return {
                        VIN: vehicle.vin || "",
                        "Stock #": vehicle.stock_number || "",
                        Year: vehicle.year || "",
                        Make: vehicle.make || "",
                        Model: vehicle.model || "",
                        Trim: vehicle.trim || "",
                        Condition: vehicle.condition || "",
                        Status: vehicle.status || "",
                        Odometer: vehicle.odometer || 0,
                        "Exterior Color": vehicle.exterior_color || "",
                        "Interior Color": vehicle.interior_color || "",
                        "Purchase Price": vehicle.purchase_price || 0,
                        "Extra Costs": vehicle.extra_costs || 0,
                        "Retail Price": vehicle.retail_price || 0,
                        "Est. Income": estIncome,
                        "Days in Stock": days,
                        Description: vehicle.description || "",
                    };
                }
            );

            await downloadXlsx(
                worksheetData,
                "Vehicles",
                `vehicles-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 20 },
                    { wch: 12 },
                    { wch: 8 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 10 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 12 },
                    { wch: 15 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 40 },
                ]
            );
            toast.success(`Export complete (${exportData.length} rows, current filters)`);
        } catch (err) {
            console.error("Export error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to export vehicles");
        } finally {
            setExportLoading(false);
        }
    }

    const handleViewDetails = (vehicle: Vehicle) => {
        router.push(`/inventory/${encodeURIComponent(vehicle.vin)}`);
    };

    const handleEdit = (vehicle: Vehicle) => {
        router.push(`/inventory/${encodeURIComponent(vehicle.vin)}/edit`);
    };

    const handlePrintSticker = (vehicle: Vehicle) => {
        const ok = printWindowSticker(vehicle);
        if (!ok) toast.error("Allow pop-ups to print the window sticker");
    };

    const handleAdd = () => {
        router.push("/inventory/add");
    };

    const setView = (mode: "table" | "grid") => {
        setViewMode(mode);
        try {
            localStorage.setItem("adaptus:inventory-view", mode);
        } catch {
            // ignore
        }
    };

    const handleDelete = (vehicle: Vehicle) => {
        setConfirmDialogData({ vehicle, loading: false });
        setShowConfirmDialog(true);
    };

    async function confirmDelete() {
        if (!confirmDialogData.vehicle) return;

        const vehicleId = confirmDialogData.vehicle.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete vehicle");
            }

            setConfirmDialogData({ vehicle: null, loading: false });
            setShowConfirmDialog(false);
            setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
            setTotalItems((prev) => prev - 1);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(vehicleId);
                return next;
            });
            toast.success("Vehicle deleted");
            fetchVehicles();
            fetchKpis();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const allPageSelected =
        vehicles.length > 0 && vehicles.every((v) => selectedIds.has(v.id));

    const toggleSelectAll = () => {
        if (allPageSelected) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const v of vehicles) next.delete(v.id);
                return next;
            });
        } else {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const v of vehicles) next.add(v.id);
                return next;
            });
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    async function bulkSetStatus(status: string) {
        if (selectedIds.size === 0) return;
        setBulkBusy(true);
        try {
            const ids = Array.from(selectedIds);
            const results = await Promise.allSettled(
                ids.map((id) =>
                    fetch(`/api/vehicles/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ status }),
                    }).then(async (res) => {
                        if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            throw new Error(body.error || `Failed (${res.status})`);
                        }
                    })
                )
            );
            const failed = results.filter((r) => r.status === "rejected").length;
            const ok = results.length - failed;
            if (ok) toast.success(`Updated status to ${status} (${ok})`);
            if (failed) toast.error(`${failed} update(s) failed`);
            setSelectedIds(new Set());
            await fetchVehicles();
            await fetchKpis();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bulk status failed");
        } finally {
            setBulkBusy(false);
        }
    }

    async function bulkDelete() {
        if (selectedIds.size === 0) return;
        setBulkBusy(true);
        try {
            const ids = Array.from(selectedIds);
            const results = await Promise.allSettled(
                ids.map((id) =>
                    fetch(`/api/vehicles/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                    }).then(async (res) => {
                        if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            throw new Error(body.error || `Failed (${res.status})`);
                        }
                    })
                )
            );
            const failed = results.filter((r) => r.status === "rejected").length;
            const ok = results.length - failed;
            if (ok) toast.success(`Deleted ${ok} vehicle(s)`);
            if (failed) toast.error(`${failed} delete(s) failed`);
            setSelectedIds(new Set());
            setBulkDeleteConfirm(false);
            await fetchVehicles();
            await fetchKpis();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bulk delete failed");
        } finally {
            setBulkBusy(false);
        }
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
        }).format(amount);

    const formatRetailPlusTaxes = (amount: number) =>
        amount > 0 ? `${formatCurrency(amount)} + taxes` : formatCurrency(amount);

    const calculateGrossProfit = (vehicle: Vehicle) =>
        calcEstimatedIncome({
            retail: vehicle.retail_price,
            purchase: vehicle.purchase_price,
            extraCosts: vehicle.extra_costs,
            taxes: vehicle.taxes,
        });

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const writeOk = isPlatformAdmin || userRole === "Admin" || canWrite("vehicles");
    const deleteOk = isPlatformAdmin || userRole === "Admin" || canDelete("vehicles");
    const hasFilters = Boolean(
        debouncedSearch ||
            statusFilter !== "Active" ||
            advActiveCount > 0 ||
            agingOnly
    );
    /** True empty dealership — don't treat default Active tab as a "filter". */
    const isFirstUse =
        kpis.total === 0 && !debouncedSearch && advActiveCount === 0 && !agingOnly;

    const drillAging = () => {
        setAgingOnly(true);
        setStatusFilter("Active");
        setCurrentPage(1);
        toast.info(`Showing Active units ≥${AGING_DAYS} days`);
    };

    const rowActions = (vehicle: Vehicle) => (
        <RowActionsMenu
            primary={
                <button
                    type="button"
                    onClick={() => handleViewDetails(vehicle)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                    title="View"
                    aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                >
                    <Eye className="h-4 w-4" />
                </button>
            }
            items={[
                ...(writeOk
                    ? [
                          {
                              label: "Edit",
                              icon: <Edit className="h-3.5 w-3.5" />,
                              onClick: () => handleEdit(vehicle),
                          },
                      ]
                    : []),
                {
                    label: "Print sticker",
                    icon: <Printer className="h-3.5 w-3.5" />,
                    onClick: () => handlePrintSticker(vehicle),
                },
                ...(deleteOk
                    ? [
                          {
                              label: "Delete",
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              tone: "destructive" as const,
                              onClick: () => handleDelete(vehicle),
                          },
                      ]
                    : []),
            ]}
        />
    );

    const emptyKind = resolveListEmptyKind({
        hasFilters: !isFirstUse && hasFilters,
        forbidden,
    });
    const emptyBlock = (
        <EmptyState
            kind={emptyKind === "permission" ? "permission" : isFirstUse ? "first-use" : "no-results"}
            icon={Car}
            title={
                emptyKind === "permission"
                    ? "You don't have access"
                    : isFirstUse
                      ? "No vehicles yet"
                      : "No vehicles match"
            }
            description={
                emptyKind === "permission"
                    ? "Ask your administrator for inventory read access."
                    : isFirstUse
                      ? writeOk
                          ? "Add your first vehicle to start tracking inventory. Flag known damage before you publish Active."
                          : "Inventory is empty. Ask an admin to grant write access so you can add the first unit."
                      : hasFilters
                        ? "Try another status filter or clear your search."
                        : "No Active units — switch status or add a vehicle."
            }
            action={
                writeOk && isFirstUse && emptyKind !== "permission"
                    ? { label: "Add vehicle", onClick: handleAdd, icon: Plus }
                    : undefined
            }
            keyboardHint={isFirstUse && emptyKind !== "permission"}
            className="border-0 bg-transparent py-10"
        />
    );

    const colSpan = table.getVisibleLeafColumns().length;

    return (
        <ListPageShell
            title="Inventory"
            description="Vehicle stock, pricing, and status"
            icon={Car}
            meta={
                !loading && !error ? (
                    <span className="text-sm text-muted-foreground">
                        {totalItems.toLocaleString()} vehicle{totalItems === 1 ? "" : "s"}
                        {agingOnly
                            ? ` · Aging ≥${AGING_DAYS}d`
                            : statusFilter
                              ? ` · ${statusFilter}`
                              : ""}
                    </span>
                ) : undefined
            }
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchVehicles()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToExcel} disabled={exportLoading}>
                        {exportLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void exportAutoTraderFeed()}
                        disabled={atFeedLoading}
                        title="Download AutoTrader Canada pipe feed for current status filter (export only — not auto-post)"
                    >
                        {atFeedLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">AT.ca feed</span>
                    </Button>
                    {writeOk && (
                        <Button size="sm" onClick={handleAdd}>
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Add Vehicle</span>
                        </Button>
                    )}
                </div>
            }
            kpis={
                <MetricStrip
                    loading={kpiLoading}
                    items={[
                        {
                            label: "Active",
                            value: kpis.active,
                            tone: "success",
                            onClick: () => {
                                setAgingOnly(false);
                                setStatusFilter("Active");
                                setCurrentPage(1);
                            },
                        },
                        {
                            label: "Sold",
                            value: kpis.sold,
                            onClick: () => {
                                setAgingOnly(false);
                                setStatusFilter("Sold");
                                setCurrentPage(1);
                            },
                        },
                        {
                            label: "Aging",
                            value: kpis.aging,
                            tone: kpis.aging > 0 ? "warning" : "default",
                            hint: `≥${AGING_DAYS}d active · click`,
                            onClick: drillAging,
                        },
                        {
                            label: "Total",
                            value: kpis.total,
                            onClick: () => {
                                setAgingOnly(false);
                                setStatusFilter("");
                                setCurrentPage(1);
                            },
                        },
                    ]}
                />
            }
            toolbar={
                <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search VIN, make, model, stock…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="min-h-10 w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground shadow-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
                            />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center">
                            <input
                                type="text"
                                placeholder='Ask Flash AI: "red SUVs under 30k aging 60d+"'
                                value={nlQuery}
                                onChange={(e) => setNlQuery(e.target.value)}
                                className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={nlBusy}
                                onClick={() => void runNlSearch()}
                            >
                                {nlBusy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Flash AI"
                                )}
                            </Button>
                        </div>
                        {nlMissing ? <AiNotConfiguredBanner compact className="w-full" /> : null}
                        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
                        <FilterChipGroup aria-label="Status filter">
                            {STATUS_TABS.map((tab) => (
                                <FilterChip
                                    key={tab.label}
                                    selected={!agingOnly && statusFilter === tab.value}
                                    onClick={() => {
                                        setAgingOnly(false);
                                        setStatusFilter(tab.value);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {tab.label}
                                </FilterChip>
                            ))}
                        </FilterChipGroup>
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden md:inline-flex"
                            onClick={() => setShowAdvanced((v) => !v)}
                            aria-expanded={showAdvanced}
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filters
                            {advActiveCount > 0 ? (
                                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-xs tabular-nums text-primary">
                                    {advActiveCount}
                                </span>
                            ) : null}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="md:hidden"
                            onClick={() => setMobileFiltersOpen(true)}
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filters
                            {advActiveCount > 0 ? (
                                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-xs tabular-nums text-primary">
                                    {advActiveCount}
                                </span>
                            ) : null}
                        </Button>
                        {advActiveCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearAdvanced}>
                                <X className="h-4 w-4" />
                                Clear
                            </Button>
                        )}
                        <DeskTableColumnsMenu table={table} />
                        <SegmentedControl
                            aria-label="View mode"
                            value={viewMode}
                            onChange={setView}
                            options={[
                                { value: "table", label: "Table", icon: <List className="h-3.5 w-3.5" /> },
                                { value: "grid", label: "Grid", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                            ]}
                        />
                        </div>
                    </div>
                    {showAdvanced && (
                        <div className="hidden gap-3 rounded-md border border-border bg-background p-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Make</span>
                                <input
                                    className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    value={advDraft.make}
                                    onChange={(e) => setAdvDraft({ ...advDraft, make: e.target.value })}
                                    placeholder="e.g. Toyota"
                                />
                            </label>
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Year min</span>
                                <input
                                    type="number"
                                    className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    value={advDraft.minYear}
                                    onChange={(e) => setAdvDraft({ ...advDraft, minYear: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Year max</span>
                                <input
                                    type="number"
                                    className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    value={advDraft.maxYear}
                                    onChange={(e) => setAdvDraft({ ...advDraft, maxYear: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Price min</span>
                                <input
                                    type="number"
                                    className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    value={advDraft.minPrice}
                                    onChange={(e) => setAdvDraft({ ...advDraft, minPrice: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Price max</span>
                                <input
                                    type="number"
                                    className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    value={advDraft.maxPrice}
                                    onChange={(e) => setAdvDraft({ ...advDraft, maxPrice: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Condition</span>
                                <select
                                    className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    value={advDraft.condition}
                                    onChange={(e) => setAdvDraft({ ...advDraft, condition: e.target.value })}
                                >
                                    <option value="">Any</option>
                                    <option value="New">New</option>
                                    <option value="Used">Used</option>
                                    <option value="Certified">Certified</option>
                                </select>
                            </label>
                            {locations.length > 0 && (
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Location</span>
                                    <select
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                        value={advDraft.locationId}
                                        onChange={(e) => setAdvDraft({ ...advDraft, locationId: e.target.value })}
                                    >
                                        <option value="">All locations</option>
                                        {locations.map((loc) => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-3 xl:col-span-6">
                                <Button size="sm" onClick={applyAdvanced}>
                                    Apply filters
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowAdvanced(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                    <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Inventory filters</DrawerTitle>
                                <DrawerDescription>
                                    Narrow stock by make, year, price, and condition.
                                </DrawerDescription>
                            </DrawerHeader>
                            <div className="grid gap-3 overflow-y-auto px-4 pb-2">
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Make</span>
                                    <input
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                        value={advDraft.make}
                                        onChange={(e) => setAdvDraft({ ...advDraft, make: e.target.value })}
                                        placeholder="e.g. Toyota"
                                    />
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block space-y-1 text-xs">
                                        <span className="font-medium text-muted-foreground">Year min</span>
                                        <input
                                            type="number"
                                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                            value={advDraft.minYear}
                                            onChange={(e) =>
                                                setAdvDraft({ ...advDraft, minYear: e.target.value })
                                            }
                                        />
                                    </label>
                                    <label className="block space-y-1 text-xs">
                                        <span className="font-medium text-muted-foreground">Year max</span>
                                        <input
                                            type="number"
                                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                            value={advDraft.maxYear}
                                            onChange={(e) =>
                                                setAdvDraft({ ...advDraft, maxYear: e.target.value })
                                            }
                                        />
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block space-y-1 text-xs">
                                        <span className="font-medium text-muted-foreground">Price min</span>
                                        <input
                                            type="number"
                                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                            value={advDraft.minPrice}
                                            onChange={(e) =>
                                                setAdvDraft({ ...advDraft, minPrice: e.target.value })
                                            }
                                        />
                                    </label>
                                    <label className="block space-y-1 text-xs">
                                        <span className="font-medium text-muted-foreground">Price max</span>
                                        <input
                                            type="number"
                                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                            value={advDraft.maxPrice}
                                            onChange={(e) =>
                                                setAdvDraft({ ...advDraft, maxPrice: e.target.value })
                                            }
                                        />
                                    </label>
                                </div>
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Condition</span>
                                    <select
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                        value={advDraft.condition}
                                        onChange={(e) =>
                                            setAdvDraft({ ...advDraft, condition: e.target.value })
                                        }
                                    >
                                        <option value="">Any</option>
                                        <option value="New">New</option>
                                        <option value="Used">Used</option>
                                        <option value="Certified">Certified</option>
                                    </select>
                                </label>
                                {locations.length > 0 && (
                                    <label className="block space-y-1 text-xs">
                                        <span className="font-medium text-muted-foreground">Location</span>
                                        <select
                                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                            value={advDraft.locationId}
                                            onChange={(e) =>
                                                setAdvDraft({ ...advDraft, locationId: e.target.value })
                                            }
                                        >
                                            <option value="">All locations</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>
                            <DrawerFooter>
                                <Button
                                    onClick={() => {
                                        applyAdvanced();
                                        setMobileFiltersOpen(false);
                                    }}
                                >
                                    Apply filters
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        clearAdvanced();
                                        setMobileFiltersOpen(false);
                                    }}
                                >
                                    Clear
                                </Button>
                            </DrawerFooter>
                        </DrawerContent>
                    </Drawer>
                    {selectedIds.size > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                            <span className="text-sm font-medium tabular-nums">
                                {selectedIds.size} selected
                            </span>
                            {writeOk && (
                                <select
                                    className="min-h-9 rounded-md border border-border bg-background px-2 text-sm"
                                    defaultValue=""
                                    disabled={bulkBusy}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        e.target.value = "";
                                        if (v) void bulkSetStatus(v);
                                    }}
                                    aria-label="Bulk set status"
                                >
                                    <option value="" disabled>
                                        Set status…
                                    </option>
                                    {BULK_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={atFeedLoading || bulkBusy}
                                onClick={() => void exportAutoTraderFeed(Array.from(selectedIds))}
                                title="AT.ca feed for selection (export only — not auto-post)"
                            >
                                AT.ca feed
                            </Button>
                            {deleteOk && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={bulkBusy}
                                    onClick={() => setBulkDeleteConfirm(true)}
                                    className="text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                                disabled={bulkBusy}
                            >
                                Clear
                            </Button>
                            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                    )}
                </div>
            }
        >
            <DataTableShell>
                <EquityTriggersBanner
                    mode="inventory"
                    inventoryHref="#"
                    customersHref="/customers"
                />
                {viewMode === "table" ? (
                    <DataTableScroll>
                        <DataTable>
                            <DataTableHead>
                                <DataTableHeaderRow>
                                    {colVisible("select") && (
                                        <DataTableTh className="w-[44px]">
                                            <input
                                                type="checkbox"
                                                checked={allPageSelected}
                                                onChange={toggleSelectAll}
                                                aria-label="Select all on page"
                                                className="h-4 w-4 rounded border-border"
                                            />
                                        </DataTableTh>
                                    )}
                                    {colVisible("photo") && (
                                        <DataTableTh className="w-[72px]">Photo</DataTableTh>
                                    )}
                                    {colVisible("vehicle") && <DataTableTh>Vehicle</DataTableTh>}
                                    {colVisible("stock") && (
                                        <DataTableTh className="w-[88px]">Stock</DataTableTh>
                                    )}
                                    {colVisible("status") && (
                                        <DataTableTh className="w-[100px]">Status</DataTableTh>
                                    )}
                                    {colVisible("cost") && table.getColumn("cost") && (
                                        <DataTableTh className="w-[96px] text-right">
                                            <DeskTableSortHeader
                                                column={table.getColumn("cost")!}
                                                title="Cost"
                                                align="right"
                                            />
                                        </DataTableTh>
                                    )}
                                    {colVisible("retail") && table.getColumn("retail") && (
                                        <DataTableTh className="w-[96px] text-right">
                                            <DeskTableSortHeader
                                                column={table.getColumn("retail")!}
                                                title="Retail"
                                                align="right"
                                            />
                                        </DataTableTh>
                                    )}
                                    {colVisible("est_income") && (
                                        <DataTableTh className="w-[96px] text-right">Est. income</DataTableTh>
                                    )}
                                    {colVisible("days") && table.getColumn("days") && (
                                        <DataTableTh className="w-[72px] text-right">
                                            <DeskTableSortHeader
                                                column={table.getColumn("days")!}
                                                title="Days"
                                                align="right"
                                            />
                                        </DataTableTh>
                                    )}
                                    {colVisible("cfx") && (
                                        <DataTableTh className="w-[56px] text-center">CFX</DataTableTh>
                                    )}
                                    {colVisible("actions") && (
                                        <DataTableTh className="w-[72px] text-right">Actions</DataTableTh>
                                    )}
                                </DataTableHeaderRow>
                            </DataTableHead>
                            <DataTableBody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={colSpan} className="p-6">
                                            <SkeletonTable rows={8} cols={6} />
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={colSpan} className="p-6">
                                            <EmptyState
                                                kind={forbidden ? "permission" : "error"}
                                                title={
                                                    forbidden
                                                        ? "You don't have access"
                                                        : "Couldn't load inventory"
                                                }
                                                description={
                                                    forbidden
                                                        ? "Ask your administrator for inventory read access."
                                                        : error
                                                }
                                                action={
                                                    forbidden
                                                        ? undefined
                                                        : { label: "Try again", onClick: () => fetchVehicles() }
                                                }
                                                className="border-0 bg-transparent py-10"
                                            />
                                        </td>
                                    </tr>
                                ) : vehicles.length === 0 ? (
                                    <tr>
                                        <td colSpan={colSpan} className="p-6">
                                            {emptyBlock}
                                        </td>
                                    </tr>
                                ) : (
                                    vehicles.map((vehicle) => {
                                        const estIncome = calculateGrossProfit(vehicle);
                                        const days = daysInStock(vehicle.created_at);
                                        const gallery = resolveGallery(vehicle.image_gallery, vehicle.images);
                                        const agingHot = days >= AGING_DAYS && vehicle.status === "Active";
                                        const equityCandidate =
                                            days >= 45 && vehicle.status === "Active";
                                        return (
                                            <ClickableDataTableRow
                                                key={vehicle.id}
                                                onRowClick={() => handleViewDetails(vehicle)}
                                            >
                                                {colVisible("select") && (
                                                    <DataTableTd onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(vehicle.id)}
                                                            onChange={() => toggleSelect(vehicle.id)}
                                                            aria-label={`Select ${vehicle.vin}`}
                                                            className="h-4 w-4 rounded border-border"
                                                        />
                                                    </DataTableTd>
                                                )}
                                                {colVisible("photo") && (
                                                    <DataTableTd>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewDetails(vehicle);
                                                            }}
                                                            className="block h-12 w-16 overflow-hidden rounded-md border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                                                            aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                                        >
                                                            <VehicleImage
                                                                gallery={gallery}
                                                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                                                variant="card"
                                                                showCount
                                                                sizes="64px"
                                                            />
                                                        </button>
                                                    </DataTableTd>
                                                )}
                                                {colVisible("vehicle") && (
                                                    <DataTableTd>
                                                        <EntityLink onClick={() => handleViewDetails(vehicle)}>
                                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                                        </EntityLink>
                                                        <p className={dataTableVinClass}>{vehicle.vin}</p>
                                                    </DataTableTd>
                                                )}
                                                {colVisible("stock") && (
                                                    <DataTableTd className="text-foreground/90">
                                                        {vehicle.stock_number || "—"}
                                                    </DataTableTd>
                                                )}
                                                {colVisible("status") && (
                                                    <DataTableTd>
                                                        <StatusBadge status={vehicle.status} resource="vehicle" />
                                                    </DataTableTd>
                                                )}
                                                {colVisible("cost") && (
                                                    <DataTableTdNum className="text-muted-foreground">
                                                        {formatCurrency(vehicle.purchase_price || 0)}
                                                    </DataTableTdNum>
                                                )}
                                                {colVisible("retail") && (
                                                    <DataTableTdNum className="font-medium">
                                                        {formatRetailPlusTaxes(vehicle.retail_price)}
                                                    </DataTableTdNum>
                                                )}
                                                {colVisible("est_income") && (
                                                    <DataTableTdNum
                                                        className={cn(
                                                            "font-medium",
                                                            estIncome >= 0 ? "text-success" : "text-destructive"
                                                        )}
                                                    >
                                                        {formatCurrency(estIncome)}
                                                    </DataTableTdNum>
                                                )}
                                                {colVisible("days") && (
                                                    <td
                                                        className={cn(
                                                            dataTableTdMutedNumClass,
                                                            agingHot && "font-semibold text-warning"
                                                        )}
                                                    >
                                                        {days}
                                                        {equityCandidate && (
                                                            <span className="ml-1 rounded border border-amber-300 bg-amber-50 px-1 text-[10px] font-medium text-amber-700">
                                                                equity
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                {colVisible("cfx") && (
                                                    <DataTableTd className="text-center">
                                                        {vehicle.carfax_report_url ? (
                                                            <a
                                                                href={vehicle.carfax_report_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-2 text-destructive hover:bg-destructive-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                title="CARFAX report"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted-foreground/40">—</span>
                                                        )}
                                                    </DataTableTd>
                                                )}
                                                {colVisible("actions") && (
                                                    <DataTableTd className="text-right">{rowActions(vehicle)}</DataTableTd>
                                                )}
                                            </ClickableDataTableRow>
                                        );
                                    })
                                )}
                            </DataTableBody>
                        </DataTable>
                    </DataTableScroll>
                ) : (
                    <div className="p-3">
                        {loading ? (
                            <div className="p-6">
                                <SkeletonTable rows={6} cols={4} />
                            </div>
                        ) : error ? (
                            <EmptyState
                                kind={forbidden ? "permission" : "error"}
                                title={
                                    forbidden
                                        ? "You don't have access"
                                        : "Couldn't load inventory"
                                }
                                description={
                                    forbidden
                                        ? "Ask your administrator for inventory read access."
                                        : error
                                }
                                action={
                                    forbidden
                                        ? undefined
                                        : { label: "Try again", onClick: () => fetchVehicles() }
                                }
                                className="m-4"
                            />
                        ) : vehicles.length === 0 ? (
                            emptyBlock
                        ) : (
                            <VirtualList
                                items={vehicles}
                                estimateSize={340}
                                height={Math.min(720, Math.max(360, vehicles.length * 120))}
                                overscan={4}
                                getItemKey={(v) => v.id}
                                className="pr-1"
                                renderItem={(vehicle) => {
                                    const estIncome = calculateGrossProfit(vehicle);
                                    const days = daysInStock(vehicle.created_at);
                                    const gallery = resolveGallery(vehicle.image_gallery, vehicle.images);
                                    return (
                                        <div className="pb-3">
                                            <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-border/80 hover:bg-muted/20">
                                                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(vehicle.id)}
                                                        onChange={() => toggleSelect(vehicle.id)}
                                                        aria-label={`Select ${vehicle.vin}`}
                                                        className="h-4 w-4 rounded border-border"
                                                    />
                                                    <span className="text-xs text-muted-foreground">Select</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewDetails(vehicle)}
                                                    className="block aspect-[16/10] w-full overflow-hidden bg-muted"
                                                >
                                                    <VehicleImage
                                                        gallery={gallery}
                                                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                                        variant="card"
                                                        showCount
                                                        sizes="(max-width:640px) 100vw, 33vw"
                                                    />
                                                </button>
                                                <div className="space-y-3 p-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(vehicle)}
                                                        className="w-full text-left"
                                                    >
                                                        <p className="truncate font-medium text-foreground">
                                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                                        </p>
                                                        <p className={cn(dataTableVinClass, "truncate")}>
                                                            {vehicle.stock_number ? `#${vehicle.stock_number} · ` : ""}
                                                            {vehicle.vin}
                                                        </p>
                                                    </button>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <StatusBadge status={vehicle.status} resource="vehicle" />
                                                        <span className="text-xs tabular-nums text-muted-foreground">
                                                            {days}d in stock
                                                        </span>
                                                    </div>
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="text-sm font-semibold tabular-nums text-foreground">
                                                            {formatRetailPlusTaxes(vehicle.retail_price)}
                                                        </span>
                                                        <span className="text-xs tabular-nums text-muted-foreground">
                                                            Cost {formatCurrency(vehicle.purchase_price || 0)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span
                                                            className={cn(
                                                                "text-xs font-medium tabular-nums",
                                                                estIncome >= 0 ? "text-success" : "text-destructive"
                                                            )}
                                                        >
                                                            Est. {formatCurrency(estIncome)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-end border-t border-border pt-2">
                                                        {rowActions(vehicle)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        )}
                    </div>
                )}

                {!loading && !error && vehicles.length > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + 1}–
                            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                disabled={currentPage >= totalPages}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </DataTableShell>

            {showConfirmDialog && confirmDialogData.vehicle && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Vehicle"
                    message={`Delete ${confirmDialogData.vehicle.year} ${confirmDialogData.vehicle.make} ${confirmDialogData.vehicle.model}? This cannot be undone.`}
                    confirmText="Delete"
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={() => void confirmDelete()}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ vehicle: null, loading: false });
                    }}
                />
            )}

            {bulkDeleteConfirm && (
                <ConfirmDialog
                    isOpen={bulkDeleteConfirm}
                    title="Delete selected vehicles"
                    message={`Delete ${selectedIds.size} vehicle(s)? This cannot be undone.`}
                    confirmText="Delete all"
                    variant="danger"
                    loading={bulkBusy}
                    onConfirm={() => void bulkDelete()}
                    onCancel={() => setBulkDeleteConfirm(false)}
                />
            )}
        </ListPageShell>
    );
}
