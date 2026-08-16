"use client";

import { useState, useEffect } from "react";
import {
    Shield,
    Plus,
    Edit,
    Trash2,
    Loader2,
    AlertCircle,
    CheckCircle,
    Lock,
    Unlock,
} from "lucide-react";
import RoleModal from "@/src/components/RoleModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";

import { toast } from "@/src/lib/toast";

interface Role {
    id: string;
    name: string;
    description: string | null;
    is_system: boolean;
    permissions: string[];
    dealership_id: string | null;
    created_at: string;
}

interface ApiResponse {
    data: Role[];
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        role: Role | null;
        loading: boolean;
    }>({ role: null, loading: false });

    useEffect(() => {
        fetchRoles();
    }, []);

    async function fetchRoles() {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/api/roles", {
                headers: {
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Session is in HttpOnly cookies, not localStorage. Just redirect.
                    window.location.assign(new URL("/login", window.location.origin).href);
                    return;
                }
                throw new Error("Failed to fetch roles");
            }

            const data: ApiResponse = await response.json();
            setRoles(data.data);
        } catch (error: unknown) {
            console.error("Error fetching roles:", error);
            setError(error instanceof Error ? error.message : "Failed to load roles");
        } finally {
            setLoading(false);
        }
    }

    const handleAddRole = () => {
        setFormMode("add");
        setSelectedRole(null);
        setShowModal(true);
    };

    const handleEditRole = (role: Role) => {
        setFormMode("edit");
        setSelectedRole(role);
        setShowModal(true);
    };

    const handleDeleteRole = (role: Role) => {
        setConfirmDialogData({ role, loading: false });
        setShowConfirmDialog(true);
    };

    async function confirmDelete() {
        if (!confirmDialogData.role) return;

        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/roles/${confirmDialogData.role.id}`, {
                method: "DELETE",
                headers: {
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to delete role");
            }

            setShowConfirmDialog(false);
            fetchRoles();
        } catch (error: unknown) {
            console.error("Error deleting role:", error);
            toast.error(error instanceof Error ? error.message : "Failed to delete role");
        } finally {
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const getRoleIcon = (roleName: string) => {
        const icons: Record<string, string> = {
            Admin: "bg-purple-100 text-purple-700",
            Manager: "bg-blue-100 text-blue-700",
            Salesperson: "bg-orange-100 text-orange-700",
            Staff: "bg-green-100 text-green-700",
            Custom: "bg-gray-100 text-gray-700"
        };
        return icons[roleName] || "bg-gray-100 text-gray-700";
    };

    const formatPermissions = (permissions: string[]) => {
        if (permissions.includes("*")) return "Full Access";
        if (permissions.length === 0) return "No permissions";
        return `${permissions.length} permission(s)`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage roles and their access permissions
                        </p>
                    </div>
                    <button
                        onClick={handleAddRole}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Role
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                        <p className="text-sm text-gray-500">Loading roles...</p>
                    </div>
                ) : roles.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 flex flex-col items-center justify-center">
                        <Shield className="w-12 h-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No roles found</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Get started by creating your first role
                        </p>
                        <button
                            onClick={handleAddRole}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Role
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roles.map((role) => (
                            <div
                                key={role.id}
                                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getRoleIcon(role.name)}`}>
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900">{role.name}</h3>
                                            {role.is_system && (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                    <Lock className="w-3 h-3" /> System Role
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {!role.is_system && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditRole(role)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRole(role)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <p className="text-sm text-gray-500 mb-3">
                                    {role.description || "No description"}
                                </p>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <span className="text-xs text-gray-500">
                                        {formatPermissions(role.permissions || [])}
                                    </span>
                                    {role.permissions?.includes("*") ? (
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <Unlock className="w-4 h-4 text-gray-400" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <RoleModal
                    mode={formMode}
                    role={selectedRole}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        fetchRoles();
                    }}
                />
            )}

            {/* Confirm Dialog */}
            {showConfirmDialog && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Role"
                    message={`Are you sure you want to delete the role "${confirmDialogData.role?.name}"? Users with this role will lose their permissions.`}
                    confirmText="Delete"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                    variant="danger"
                />
            )}
        </div>
    );
}
