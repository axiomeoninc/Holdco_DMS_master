"use client";

import { useState, useEffect } from "react";
import {
    Users,
    Search,
    Filter,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    Download,
    RefreshCw,
    AlertCircle,
    Mail,
    Phone,
    Calendar,
    UserPlus,
    Building2,
} from "lucide-react";
import UserDetailsModal from "@/src/components/UserDetailsModal";
import UserFormModal from "@/src/components/UserFormModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Avatar } from "@/src/components/ui/Avatar";
import { RowActionsMenu } from "@/src/components/ui/RowActionsMenu";
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

interface User {
    id: string;
    avatar: string | null;
    full_name: string;
    role: string;
    email: string;
    phone: string | null;
    start_date: string;
    created_at: string;
    updated_at: string;
    is_platform_admin?: boolean;
    dealership_id?: string;
    dealership_name?: string;
}

interface MeData {
    is_platform_admin?: boolean;
    role?: string;
}

interface DealershipOption {
    id: string;
    name: string;
}

interface ApiResponse {
    data: User[];
    count: number;
    limit: number;
    offset: number;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [userData, setUserData] = useState<MeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(10);
    const [dealershipFilter, setDealershipFilter] = useState<string>("");
    const [dealerships, setDealerships] = useState<DealershipOption[]>([]);

    // Date filters
    const [startDateFrom, setStartDateFrom] = useState("");
    const [startDateTo, setStartDateTo] = useState("");
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        user: User | null;
        loading: boolean;
    }>({ user: null, loading: false });

    useEffect(() => {
        fetchUserData();
    }, []);

    useEffect(() => {
        if (userData) {
            fetchUsers();
            if (userData.is_platform_admin) {
                fetchDealerships();
            }
        }
    }, [userData, currentPage, roleFilter, searchTerm, startDateFrom, startDateTo, dealershipFilter]);

    async function fetchUserData() {
        try {
            const response = await fetch("/api/me", {
            });
            if (response.ok) {
                const data = await response.json();
                const me = data.data;
                // Defense in depth with middleware: non-Admin dealers leave this shell
                if (
                    me &&
                    !me.is_platform_admin &&
                    me.role !== "Admin"
                ) {
                    window.location.assign(new URL("/dashboard", window.location.origin).href);
                    return;
                }
                setUserData(me);
            }
        } catch (err) {
            console.error("Error fetching user:", err);
        }
    }

    async function fetchDealerships() {
        try {
            const response = await fetch("/api/dealerships", {
            });
            if (response.ok) {
                const data = await response.json();
                setDealerships(data.data || []);
            }
        } catch (err) {
            console.error("Error fetching dealerships:", err);
        }
    }

    async function fetchUsers() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/users?limit=${itemsPerPage}&offset=${offset}`;
            if (roleFilter) url += `&role=${roleFilter}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
            if (startDateFrom) url += `&start_date_from=${startDateFrom}`;
            if (startDateTo) url += `&start_date_to=${startDateTo}`;
            if (dealershipFilter) url += `&dealership_id=${dealershipFilter}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch users");
            }

            const data: ApiResponse = await response.json();
            setUsers(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = (user: User) => {
        setSelectedUser(user);
        setShowDetailsModal(true);
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedUser(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedUser(null);
        fetchUsers();
    };

    async function handleDelete(user: User) {
        setConfirmDialogData({ user, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.user) return;

        const userId = confirmDialogData.user.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Failed to delete user");
            }

            setConfirmDialogData({ user: null, loading: false });
            setShowConfirmDialog(false);
            setUsers((prev) => prev.filter((u) => u.id !== userId));
            setTotalItems((prev) => prev - 1);
            fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const isPlatformAdmin = userData?.is_platform_admin === true;

    const formatDate = (date: string | null | undefined) => {
        if (!date) return "—";
        const d = new Date(date);
        if (isNaN(d.getTime()) || d.getFullYear() < 1971) return "—";
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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

    async function handleExport() {
        try {
            // Fetch all users (not just the current page) for a complete export.
            let rows: User[] = users;
            try {
                const res = await fetch(`/api/users?limit=200`);
                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json.data) && json.data.length > 0) rows = json.data;
                }
            } catch (e) {
                // Fall back to the currently loaded page on any fetch error.
                console.error("Full export fetch failed, using current page:", e);
            }

            if (rows.length === 0) {
                toast.error("No users to export");
                return;
            }

            const header = ["Name", "Email", "Role", "Phone", "Start Date", "Dealership"];
            const escape = (v: unknown) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
            const csv = [
                header.join(","),
                ...rows.map((u) =>
                    [
                        escape(u.full_name),
                        escape(u.email),
                        escape(u.role),
                        escape(u.phone),
                        escape(u.start_date ? new Date(u.start_date).toLocaleDateString() : ""),
                        escape(u.dealership_name),
                    ].join(",")
                ),
            ].join("\n");

            // Blob download works in regular browsers; some embedded browsers
            // block blob downloads silently, so ALSO copy to the clipboard as a
            // guaranteed fallback and always show feedback.
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            const csvCopied = await copyToClipboard(csv);
            toast.success(
                `Exported ${rows.length} user${rows.length === 1 ? "" : "s"}` +
                (csvCopied ? " — CSV copied to clipboard" : "")
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export users");
        }
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <ListPageShell
            title={isPlatformAdmin ? "All Users" : "Users & Roles"}
            description={
                isPlatformAdmin
                    ? "AdaptUs Platform — users across all dealerships. Dealership Admins cannot grant platform admin."
                    : "Manage users in your dealership only. Manager cannot create users (Admin-only)."
            }
            icon={Users}
            breadcrumbs={
                isPlatformAdmin
                    ? [
                          { label: "AdaptUs Platform", href: "/dashboard" },
                          { label: "Users" },
                      ]
                    : undefined
            }
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchUsers()}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleExport()}>
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <UserPlus className="h-3.5 w-3.5" />
                        Add User
                    </Button>
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Total", value: totalItems, format: "number" },
                        {
                            label: "Admins (page)",
                            value: users.filter((u) => u.role === "Admin").length,
                            format: "number",
                        },
                        {
                            label: "Active (page)",
                            value: users.length,
                            format: "number",
                            tone: "success",
                        },
                    ]}
                />
            }
        >
            {error && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                    <Button variant="outline" size="sm" className="ml-auto" onClick={() => void fetchUsers()}>
                        Retry
                    </Button>
                </div>
            )}

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search by name, email, or phone…"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isPlatformAdmin && (
                        <select
                            value={dealershipFilter}
                            onChange={(e) => {
                                setDealershipFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Dealership filter"
                        >
                            <option value="">All Dealerships</option>
                            {dealerships.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Role filter"
                    >
                        <option value="">All Roles</option>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Staff">Staff</option>
                        <option value="Salesperson">Salesperson</option>
                    </select>
                    <div className="relative">
                        <Button
                            variant={showMoreFilters || startDateFrom || startDateTo ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            More
                        </Button>
                        {showMoreFilters && (
                            <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">Start date range</p>
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 text-xs text-muted-foreground">From</span>
                                        <input
                                            type="date"
                                            value={startDateFrom}
                                            onChange={(e) => setStartDateFrom(e.target.value)}
                                            className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 text-xs text-muted-foreground">To</span>
                                        <input
                                            type="date"
                                            value={startDateTo}
                                            onChange={(e) => setStartDateTo(e.target.value)}
                                            className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setStartDateFrom("");
                                                setStartDateTo("");
                                            }}
                                        >
                                            Clear
                                        </Button>
                                        <Button size="sm" className="flex-1" onClick={() => setShowMoreFilters(false)}>
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <SkeletonTable rows={6} cols={isPlatformAdmin ? 7 : 6} />
            ) : users.length === 0 ? (
                <EmptyState
                    icon={Users}
                    kind={searchTerm || roleFilter || dealershipFilter || startDateFrom || startDateTo ? "no-results" : "first-use"}
                    title="No users found"
                    description={
                        searchTerm || roleFilter || dealershipFilter || startDateFrom || startDateTo
                            ? "Try adjusting your search or filters."
                            : "Add your first team member to get started."
                    }
                    action={
                        !(searchTerm || roleFilter || dealershipFilter || startDateFrom || startDateTo)
                            ? { label: "Add User", onClick: handleAdd, icon: UserPlus }
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
                                        <DataTableTh>User</DataTableTh>
                                        {isPlatformAdmin && <DataTableTh>Dealership</DataTableTh>}
                                        <DataTableTh>Email</DataTableTh>
                                        <DataTableTh>Phone</DataTableTh>
                                        <DataTableTh>Role</DataTableTh>
                                        <DataTableTh>Start Date</DataTableTh>
                                        <DataTableTh>Status</DataTableTh>
                                        <DataTableTh className="text-right">Actions</DataTableTh>
                                    </DataTableHeaderRow>
                                </DataTableHead>
                                <DataTableBody>
                                    {users.map((user) => (
                                        <DataTableRow key={user.id}>
                                            <DataTableTd>
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar src={user.avatar} name={user.full_name} size="sm" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <p className="min-w-0 truncate font-medium text-foreground">
                                                                {user.full_name}
                                                            </p>
                                                            {user.is_platform_admin ? (
                                                                <span className="shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                                                    Platform Admin
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {user.id.slice(0, 8)}…
                                                        </p>
                                                    </div>
                                                </div>
                                            </DataTableTd>
                                            {isPlatformAdmin && (
                                                <DataTableTd>
                                                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground">
                                                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="min-w-0 truncate text-foreground">{user.dealership_name || "—"}</span>
                                                    </span>
                                                </DataTableTd>
                                            )}
                                            <DataTableTd>
                                                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="min-w-0 flex-1 truncate text-foreground">{user.email}</span>
                                                </span>
                                            </DataTableTd>
                                            <DataTableTd>
                                                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                                                    <Phone className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="min-w-0 flex-1 truncate text-foreground">{user.phone || "—"}</span>
                                                </span>
                                            </DataTableTd>
                                            <DataTableTd>
                                                <div className="min-w-0 max-w-full">
                                                    <StatusBadge status={user.role} />
                                                </div>
                                            </DataTableTd>
                                            <DataTableTd className="text-muted-foreground">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {formatDate(user.start_date)}
                                                </span>
                                            </DataTableTd>
                                            <DataTableTd>
                                                <StatusBadge status="Active" kind="success" />
                                            </DataTableTd>
                                            <DataTableTd className="text-right">
                                                <RowActionsMenu
                                                    primary={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="View user"
                                                            onClick={() => handleViewDetails(user)}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                    }
                                                    items={[
                                                        {
                                                            label: "Edit",
                                                            icon: <Edit className="h-3.5 w-3.5" />,
                                                            onClick: () => handleEdit(user),
                                                        },
                                                        {
                                                            label: "Delete",
                                                            icon: <Trash2 className="h-3.5 w-3.5" />,
                                                            tone: "destructive",
                                                            onClick: () => void handleDelete(user),
                                                        },
                                                    ]}
                                                />
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
                                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modals */}
            {showDetailsModal && selectedUser && (
                <UserDetailsModal
                    user={selectedUser}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedUser(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedUser);
                    }}
                />
            )}

            {showFormModal && (
                <UserFormModal
                    mode={formMode}
                    user={selectedUser}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.user && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete User"
                    message={`Are you sure you want to delete ${confirmDialogData.user.full_name}? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ user: null, loading: false });
                    }}
                />
            )}
        </ListPageShell>
    );
}
