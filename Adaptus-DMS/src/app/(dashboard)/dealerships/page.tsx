"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Store,
    Plus,
    Search,
    Edit,
    Trash2,
    AlertCircle,
    Users,
    RefreshCw,
} from "lucide-react";
import DealershipModal from "@/src/components/DealershipModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { FilterChip, FilterChipGroup } from "@/src/components/ui/FilterChip";
import {
    DataTableShell,
    DataTableScroll,
    DataTable,
    DataTableHead,
    DataTableHeaderRow,
    DataTableTh,
    DataTableBody,
    DataTableRow,
    DataTableTd,
} from "@/src/components/ui/DataTable";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { EmptyState } from "@/src/components/ui/EmptyState";

interface Dealership {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    business_name: string | null;
    business_address: string | null;
    business_email: string | null;
    business_phone: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    subscription?: {
        plan_name: string;
        plan_price: number;
        billing_cycle: string;
        status: string;
    };
    user_count?: number;
}

interface ApiResponse {
    data: Dealership[];
    count: number;
    limit: number;
    offset: number;
}

const STATUS_FILTERS = [
    { value: "", label: "All" },
    { value: "Active", label: "Active" },
    { value: "Trial", label: "Trial" },
    { value: "Suspended", label: "Suspended" },
    { value: "Cancelled", label: "Cancelled" },
];

export default function DealershipsPage() {
    const router = useRouter();
    const [dealerships, setDealerships] = useState<Dealership[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(10);

    const [showModal, setShowModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        dealership: Dealership | null;
        loading: boolean;
    }>({ dealership: null, loading: false });

    useEffect(() => {
        void fetchDealerships();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, statusFilter, searchTerm]);

    async function fetchDealerships() {
        try {
            setLoading(true);
            setError(null);

            const offset = (currentPage - 1) * itemsPerPage;
            let url = `/api/dealerships?limit=${itemsPerPage}&offset=${offset}`;
            if (statusFilter) url += `&status=${statusFilter}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;

            const response = await fetch(url, { headers: {} });

            if (!response.ok) {
                // 401 → session gone; 403 → authenticated but not platform admin
                // (never bounce a valid dealer session to /login — that looked like a logout bug)
                if (response.status === 401) {
                    window.location.assign(new URL("/login", window.location.origin).href);
                    return;
                }
                if (response.status === 403) {
                    router.replace("/dashboard");
                    return;
                }
                throw new Error("Failed to fetch dealerships");
            }

            const data: ApiResponse = await response.json();
            setDealerships(data.data);
            setTotalItems(data.count);
        } catch (err: unknown) {
            console.error("Error fetching dealerships:", err);
            setError(err instanceof Error ? err.message : "Failed to load dealerships");
        } finally {
            setLoading(false);
        }
    }

    const metrics = useMemo(() => {
        const active = dealerships.filter((d) => d.status === "Active").length;
        const trial = dealerships.filter((d) => d.status === "Trial").length;
        const suspended = dealerships.filter((d) => d.status === "Suspended").length;
        return [
            { label: "Shown", value: totalItems, format: "number" as const },
            { label: "Active (page)", value: active, format: "number" as const, tone: "success" as const },
            { label: "Trial (page)", value: trial, format: "number" as const, tone: "warm" as const },
            { label: "Suspended (page)", value: suspended, format: "number" as const, tone: "destructive" as const },
        ];
    }, [dealerships, totalItems]);

    const handleAddDealership = () => {
        setFormMode("add");
        setSelectedDealership(null);
        setShowModal(true);
    };

    const handleEditDealership = (dealership: Dealership) => {
        setFormMode("edit");
        setSelectedDealership(dealership);
        setShowModal(true);
    };

    const handleDeleteDealership = (dealership: Dealership) => {
        setConfirmDialogData({ dealership, loading: false });
        setShowConfirmDialog(true);
    };

    async function confirmDelete() {
        if (!confirmDialogData.dealership) return;

        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/dealerships/${confirmDialogData.dealership.id}`, {
                method: "DELETE",
                headers: {},
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to delete dealership");
            }

            if (data.soft_deleted) {
                toast.success(
                    "Soft-deleted",
                    "Dealership cancelled. Vehicles/deals/invoices were retained."
                );
            } else {
                toast.success("Deleted", "Empty dealership removed.");
            }

            setShowConfirmDialog(false);
            void fetchDealerships();
        } catch (err: unknown) {
            console.error("Error deleting dealership:", err);
            toast.error(err instanceof Error ? err.message : "Failed to delete dealership");
        } finally {
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    return (
        <ListPageShell
            title="All Dealerships"
            description="AdaptUs Platform — manage isolated tenant dealerships. Soft-delete retains inventory when a tenant has data."
            icon={Store}
            breadcrumbs={[
                { label: "AdaptUs Platform", href: "/dashboard" },
                { label: "Dealerships" },
            ]}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchDealerships()}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleAddDealership}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Dealership
                    </Button>
                </div>
            }
            kpis={<MetricStrip items={metrics} loading={loading} />}
            toolbar={
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            placeholder="Search dealerships…"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-9 min-w-0 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                    <div className="min-w-0 overflow-x-auto">
                        <FilterChipGroup aria-label="Dealership status">
                            {STATUS_FILTERS.map((opt) => (
                                <FilterChip
                                    key={opt.value || "all"}
                                    selected={statusFilter === opt.value}
                                    onClick={() => {
                                        setStatusFilter(opt.value);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {opt.label}
                                </FilterChip>
                            ))}
                        </FilterChipGroup>
                    </div>
                </div>
            }
        >
            {error && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {loading ? (
                <SkeletonTable rows={6} cols={6} />
            ) : dealerships.length === 0 ? (
                <EmptyState
                    icon={Store}
                    title="No dealerships found"
                    description={
                        searchTerm || statusFilter
                            ? "Try adjusting your search or filters."
                            : "Create the first tenant dealership on the platform."
                    }
                    action={
                        !searchTerm && !statusFilter
                            ? { label: "Add Dealership", onClick: handleAddDealership, icon: Plus }
                            : undefined
                    }
                />
            ) : (
                <>
                    <DataTableShell>
                        <DataTableScroll>
                            <DataTable>
                                <DataTableHead>
                                    <DataTableHeaderRow>
                                        <DataTableTh>Dealership</DataTableTh>
                                        <DataTableTh>Status</DataTableTh>
                                        <DataTableTh>Plan</DataTableTh>
                                        <DataTableTh>Users</DataTableTh>
                                        <DataTableTh>Created</DataTableTh>
                                        <DataTableTh className="text-right">Actions</DataTableTh>
                                    </DataTableHeaderRow>
                                </DataTableHead>
                                <DataTableBody>
                                    {dealerships.map((dealership) => (
                                        <DataTableRow key={dealership.id}>
                                            <DataTableTd>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">
                                                        {dealership.name}
                                                    </p>
                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                        {dealership.business_email || dealership.slug}
                                                    </p>
                                                </div>
                                            </DataTableTd>
                                            <DataTableTd className="whitespace-nowrap">
                                                <StatusBadge status={dealership.status} />
                                            </DataTableTd>
                                            <DataTableTd className="min-w-0">
                                                <div className="min-w-0 truncate">
                                                    {dealership.subscription?.plan_name || "No Plan"}
                                                </div>
                                                {dealership.subscription?.plan_price !== undefined && (
                                                    <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                                                        {formatCurrency(dealership.subscription.plan_price)}/mo
                                                    </div>
                                                )}
                                            </DataTableTd>
                                            <DataTableTd>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
                                                        <Users className="h-3.5 w-3.5" />
                                                        {dealership.user_count || 0}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() =>
                                                            router.push(`/dealerships/${dealership.id}/users`)
                                                        }
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </DataTableTd>
                                            <DataTableTd className="whitespace-nowrap text-muted-foreground">
                                                {formatDate(dealership.created_at)}
                                            </DataTableTd>
                                            <DataTableTd className="text-right">
                                                <div className="inline-flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Edit dealership"
                                                        onClick={() => handleEditDealership(dealership)}
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Delete dealership"
                                                        onClick={() => handleDeleteDealership(dealership)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                    </Button>
                                                </div>
                                            </DataTableTd>
                                        </DataTableRow>
                                    ))}
                                </DataTableBody>
                            </DataTable>
                        </DataTableScroll>
                    </DataTableShell>

                    {totalPages > 1 && (
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-[13px] text-muted-foreground">
                                {(currentPage - 1) * itemsPerPage + 1}–
                                {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </Button>
                                <span className="text-[13px] text-muted-foreground">
                                    {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <DealershipModal
                    mode={formMode}
                    dealership={selectedDealership}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        void fetchDealerships();
                    }}
                />
            )}

            {showConfirmDialog && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Remove dealership"
                    message={`Remove "${confirmDialogData.dealership?.name}"? If the tenant has vehicles, deals, or invoices, it will be soft-deleted (Cancelled) and data retained — including Nova floors.`}
                    confirmText="Remove"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                    variant="danger"
                />
            )}
        </ListPageShell>
    );
}
