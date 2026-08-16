"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    Users,
    Plus,
    Search,
    RefreshCw,
    Loader2,
    AlertCircle,
    Mail,
    Phone,
    Calendar,
    User,
    Shield,
    CheckCircle,
    Building2,
    ArrowLeft,
} from "lucide-react";
import UserFormModal from "@/src/components/UserFormModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";

import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";

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
    is_active: boolean;
    is_platform_admin: boolean;
}

interface Dealership {
    id: string;
    name: string;
    status: string;
}

export default function DealershipUsersPage() {
    const params = useParams();
    const router = useRouter();
    const dealershipId = params.id as string;

    const [users, setUsers] = useState<User[]>([]);
    const [dealership, setDealership] = useState<Dealership | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        user: User | null;
        loading: boolean;
    }>({ user: null, loading: false });

    useEffect(() => {
        if (dealershipId) {
            fetchDealership();
            fetchUsers();
        }
    }, [dealershipId, searchTerm]);

    async function fetchDealership() {
        try {
            const response = await fetch(`/api/dealerships/${dealershipId}`, {});
            if (response.ok) {
                const data = await response.json();
                setDealership(data.data);
            }
        } catch (err) {
            console.error("Error fetching dealership:", err);
        }
    }

    async function fetchUsers() {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/users?dealership_id=${dealershipId}&limit=100`, {});

            if (!response.ok) {
                throw new Error("Failed to fetch users");
            }

            const data = await response.json();
            // Filter by search term locally
            let filteredUsers = data.data || [];
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredUsers = filteredUsers.filter(
                    (u: User) =>
                        u.full_name.toLowerCase().includes(term) ||
                        u.email.toLowerCase().includes(term) ||
                        (u.phone && u.phone.includes(term))
                );
            }
            setUsers(filteredUsers);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleAdd = () => {
        setSelectedUser(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleDelete = (user: User) => {
        setConfirmDialogData({ user, loading: false });
        setShowConfirmDialog(true);
    };

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
            fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete user");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedUser(null);
        fetchUsers();
    };

    const getRoleColor = (role: string) => {
        const colors: Record<string, string> = {
            Admin: "bg-purple-100 text-purple-800",
            Manager: "bg-blue-100 text-blue-800",
            Staff: "bg-green-100 text-green-800",
            Salesperson: "bg-orange-100 text-orange-800"
        };
        return colors[role] || "bg-gray-100 text-gray-800";
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <ListPageShell
            title={dealership?.name ? `${dealership.name} users` : "Dealership users"}
            description="Platform view of users scoped to this tenant only. Soft-delete guards protect Nova data."
            icon={Users}
            breadcrumbs={[
                { label: "AdaptUs Platform", href: "/dashboard" },
                { label: "Dealerships", href: "/dealerships" },
                { label: "Users" },
            ]}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push("/dealerships")}>
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void fetchUsers()}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="h-3.5 w-3.5" />
                        Add User
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
            {/* legacy header hidden */}
            <div className="hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dealerships")}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-blue-600" />
                            <h1 className="text-2xl font-bold text-gray-900">
                                {dealership?.name || "Dealership"} Users
                            </h1>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage users for this dealership
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchUsers}
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
                        Add User
                    </button>
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
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Phone
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Start Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
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
                                        <p className="mt-2 text-sm text-gray-500">Loading users...</p>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                                        <p className="mt-2 text-sm text-red-600">{error}</p>
                                        <button
                                            onClick={fetchUsers}
                                            className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            Try Again
                                        </button>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <Users className="w-12 h-12 text-gray-300 mx-auto" />
                                        <p className="mt-2 text-sm text-gray-500">No users found</p>
                                        <button
                                            onClick={handleAdd}
                                            className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            Add First User
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                {user.avatar ? (
                                                    <img
                                                        src={user.avatar}
                                                        alt={user.full_name}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                                                        {getInitials(user.full_name)}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <p className="min-w-0 truncate text-sm font-medium text-gray-900">
                                                            {user.full_name}
                                                        </p>
                                                        {user.is_platform_admin && (
                                                            <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
                                                                Platform Admin
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        ID: {user.id.slice(0, 8)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                                                <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{user.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-sm text-gray-600">
                                                    {user.phone || "N/A"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-sm text-gray-600">
                                                    {formatDate(user.start_date)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                                <CheckCircle className="w-3 h-3" />
                                                Active
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Shield className="w-4 h-4 text-amber-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <User className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-gray-200">
                    {loading ? (
                        <div className="px-4 py-12 text-center">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                            <p className="mt-2 text-sm text-gray-500">Loading...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <Users className="w-12 h-12 text-gray-300 mx-auto" />
                            <p className="mt-2 text-sm text-gray-500">No users</p>
                        </div>
                    ) : (
                        users.map((user) => (
                            <div key={user.id} className="p-4">
                                <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-medium text-white">
                                            {getInitials(user.full_name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="min-w-0 truncate font-medium text-gray-900">{user.full_name}</p>
                                            <p className="min-w-0 truncate text-xs text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 whitespace-nowrap px-2 py-0.5 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="flex-1 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user)}
                                        className="flex-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            {showFormModal && (
                <UserFormModal
                    mode={formMode}
                    user={selectedUser}
                    targetDealershipId={dealershipId}
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
            </div>
        </ListPageShell>
    );
}
