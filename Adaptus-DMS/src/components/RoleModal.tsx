"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface Role {
    id: string;
    name: string;
    description: string | null;
    is_system: boolean;
    permissions: string[];
}

// Default permissions templates by role name
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
    Admin: ["*"], // Full access

    Manager: [
        // Dashboard
        "dashboard:read", "dashboard:write",
        // Leads - full access including assign
        "leads:read", "leads:write", "leads:delete", "leads:assign",
        // Test Drives - full access
        "test_drives:read", "test_drives:write", "test_drives:delete",
        // Deals - full access
        "deals:read", "deals:write", "deals:delete",
        // Follow-ups - full access
        "follow_ups:read", "follow_ups:write", "follow_ups:delete",
        // Inventory - full access except delete
        "vehicles:read", "vehicles:write",
        // Customers - full access except delete
        "customers:read", "customers:write",
        // Invoices/Expenses - full
        "invoices:read", "invoices:write",
        "expenses:read", "expenses:write",
        // Vendors - read/write
        "vendors:read", "vendors:write",
        // Reports - full access including export
        "reports:read", "reports:write", "reports:export",
        // Users - view only (cannot create admin)
        "users:read",
        // Tasks/Tickets - full including assign
        "tasks:read", "tasks:write", "tasks:delete", "tasks:assign",
        "tickets:read", "tickets:write", "tickets:delete",
        // Tools
        "tools:read", "tools:write",
        // Settings - view only
        "settings:read",
        // Profile
        "profile:read", "profile:write",
    ],

    Salesperson: [
        // Dashboard - limited to own data
        "dashboard:read",
        // Leads - assigned only
        "leads:read:assigned", "leads:write",
        // Test Drives - assigned only
        "test_drives:read:assigned", "test_drives:write",
        // Deals - assigned only
        "deals:read:assigned", "deals:write",
        // Follow-ups - assigned only
        "follow_ups:read:assigned", "follow_ups:write",
        // Inventory - view only
        "vehicles:read",
        // Customers - assigned only
        "customers:read:assigned", "customers:write",
        // Tasks - assigned only
        "tasks:read:assigned", "tasks:write",
        // Tools
        "tools:read",
        // Profile
        "profile:read", "profile:write",
    ],

    Staff: [
        // Dashboard
        "dashboard:read",
        // Leads - create and view assigned
        "leads:read:assigned", "leads:write",
        // Test Drives - schedule/view
        "test_drives:read:assigned", "test_drives:write",
        // Deals - view assigned only
        "deals:read:assigned",
        // Follow-ups - assigned
        "follow_ups:read:assigned", "follow_ups:write",
        // Inventory - view only
        "vehicles:read",
        // Customers - create and view assigned
        "customers:read:assigned", "customers:write",
        // Tasks - assigned
        "tasks:read:assigned", "tasks:write",
        // Tools
        "tools:read",
        // Profile
        "profile:read", "profile:write",
    ]
};

const PERMISSION_OPTIONS = [
    // Dashboard
    { id: "dashboard:read", label: "View Dashboard", category: "Dashboard" },
    { id: "dashboard:write", label: "Edit Dashboard", category: "Dashboard" },

    // CRM - Leads
    { id: "leads:read", label: "View All Leads", category: "Leads" },
    { id: "leads:read:assigned", label: "View Assigned Leads Only", category: "Leads" },
    { id: "leads:write", label: "Create/Edit Leads", category: "Leads" },
    { id: "leads:delete", label: "Delete Leads", category: "Leads" },
    { id: "leads:assign", label: "Assign Leads", category: "Leads" },
    { id: "leads:export", label: "Export Leads", category: "Leads" },

    // CRM - Test Drives
    { id: "test_drives:read", label: "View All Test Drives", category: "Test Drives" },
    { id: "test_drives:read:assigned", label: "View Assigned Test Drives Only", category: "Test Drives" },
    { id: "test_drives:write", label: "Create/Edit Test Drives", category: "Test Drives" },
    { id: "test_drives:delete", label: "Delete Test Drives", category: "Test Drives" },

    // CRM - Deals
    { id: "deals:read", label: "View All Deals", category: "Deals" },
    { id: "deals:read:assigned", label: "View Assigned Deals Only", category: "Deals" },
    { id: "deals:write", label: "Create/Edit Deals", category: "Deals" },
    { id: "deals:delete", label: "Delete Deals", category: "Deals" },
    { id: "deals:assign", label: "Assign Deals", category: "Deals" },
    { id: "deals:close", label: "Close Deals", category: "Deals" },
    { id: "deals:cancel", label: "Cancel Deals", category: "Deals" },

    // CRM - Follow-ups
    { id: "follow_ups:read", label: "View All Follow-ups", category: "Follow-ups" },
    { id: "follow_ups:read:assigned", label: "View Assigned Follow-ups Only", category: "Follow-ups" },
    { id: "follow_ups:write", label: "Create/Edit Follow-ups", category: "Follow-ups" },
    { id: "follow_ups:delete", label: "Delete Follow-ups", category: "Follow-ups" },

    // CRM - Customers
    { id: "customers:read", label: "View All Customers", category: "Customers" },
    { id: "customers:read:assigned", label: "View Assigned Customers Only", category: "Customers" },
    { id: "customers:write", label: "Create/Edit Customers", category: "Customers" },
    { id: "customers:delete", label: "Delete Customers", category: "Customers" },
    { id: "customers:export", label: "Export Customers", category: "Customers" },

    // Inventory - Vehicles
    { id: "vehicles:read", label: "View Vehicles", category: "Inventory" },
    { id: "vehicles:write", label: "Create/Edit Vehicles", category: "Inventory" },
    { id: "vehicles:delete", label: "Delete Vehicles", category: "Inventory" },
    { id: "vehicles:pricing", label: "Change Pricing", category: "Inventory" },
    { id: "vehicles:photos", label: "Upload Photos", category: "Inventory" },
    { id: "vehicles:carfax", label: "Upload CARFAX", category: "Inventory" },

    // Financial - Invoices
    { id: "invoices:read", label: "View Invoices", category: "Invoices" },
    { id: "invoices:write", label: "Create/Edit Invoices", category: "Invoices" },
    { id: "invoices:delete", label: "Delete Invoices", category: "Invoices" },
    { id: "invoices:export", label: "Export Invoices", category: "Invoices" },

    // Financial - Expenses
    { id: "expenses:read", label: "View Expenses", category: "Expenses" },
    { id: "expenses:write", label: "Create/Edit Expenses", category: "Expenses" },
    { id: "expenses:delete", label: "Delete Expenses", category: "Expenses" },
    { id: "expenses:export", label: "Export Expenses", category: "Expenses" },

    // Financial - Vendors
    { id: "vendors:read", label: "View Vendors", category: "Vendors" },
    { id: "vendors:write", label: "Create/Edit Vendors", category: "Vendors" },
    { id: "vendors:delete", label: "Delete Vendors", category: "Vendors" },

    // Reports
    { id: "reports:read", label: "View Reports", category: "Reports" },
    { id: "reports:export", label: "Export Reports", category: "Reports" },

    // Team - Users
    { id: "users:read", label: "View Users", category: "Users" },
    { id: "users:write", label: "Create/Edit Users", category: "Users" },
    { id: "users:delete", label: "Delete Users", category: "Users" },
    { id: "users:disable", label: "Disable Users", category: "Users" },
    { id: "users:assign_roles", label: "Assign Roles", category: "Users" },

    // Tasks
    { id: "tasks:read", label: "View All Tasks", category: "Tasks" },
    { id: "tasks:read:assigned", label: "View Assigned Tasks Only", category: "Tasks" },
    { id: "tasks:write", label: "Create/Edit Tasks", category: "Tasks" },
    { id: "tasks:delete", label: "Delete Tasks", category: "Tasks" },
    { id: "tasks:assign", label: "Assign Tasks", category: "Tasks" },

    // Tickets
    { id: "tickets:read", label: "View All Tickets", category: "Tickets" },
    { id: "tickets:read:assigned", label: "View Assigned Tickets Only", category: "Tickets" },
    { id: "tickets:write", label: "Create/Edit Tickets", category: "Tickets" },
    { id: "tickets:delete", label: "Delete Tickets", category: "Tickets" },

    // Tools
    { id: "tools:read", label: "Use Tools (OCR, VIN Lookup, Finance Calc)", category: "Tools" },
    { id: "tools:write", label: "Configure Tools", category: "Tools" },

    // AI Tools
    { id: "ai:ocr", label: "AI OCR Scanner", category: "AI Tools" },
    { id: "ai:vin_lookup", label: "AI VIN Lookup", category: "AI Tools" },
    { id: "ai:finance_calculator", label: "AI Finance Calculator", category: "AI Tools" },
    { id: "ai:receptionist", label: "AI Receptionist", category: "AI Tools" },
    { id: "ai:marketplace", label: "AI Marketplace Posting", category: "AI Tools" },
    { id: "ai:content", label: "AI Content Generator", category: "AI Tools" },

    // Settings
    { id: "settings:read", label: "View Settings", category: "Settings" },
    { id: "settings:write", label: "Edit Settings", category: "Settings" },
    { id: "settings:company", label: "Company Info", category: "Settings" },
    { id: "settings:branding", label: "Branding", category: "Settings" },
    { id: "settings:taxes", label: "Taxes", category: "Settings" },
    { id: "settings:templates", label: "Templates", category: "Settings" },
    { id: "settings:integrations", label: "Integrations", category: "Settings" },
    { id: "settings:notifications", label: "Notifications", category: "Settings" },

    // Profile
    { id: "profile:read", label: "View Own Profile", category: "Profile" },
    { id: "profile:write", label: "Edit Own Profile", category: "Profile" },
];

const SYSTEM_ROLE_NAMES = ["Admin", "Manager", "Salesperson", "Staff"];

interface RoleModalProps {
    mode: "add" | "edit";
    role: Role | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RoleModal({ mode, role, onClose, onSuccess }: RoleModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        permissions: [] as string[]
    });

    useEffect(() => {
        if (role && mode === "edit") {
            setFormData({
                name: role.name || "",
                description: role.description || "",
                permissions: role.permissions || []
            });
        } else {
            // Reset for new role
            setFormData({ name: "", description: "", permissions: [] });
        }
    }, [role, mode]);

    // Auto-populate permissions when role name changes (only in "add" mode)
    useEffect(() => {
        if (mode === "add" && formData.name && ROLE_DEFAULT_PERMISSIONS[formData.name]) {
            setFormData((prev) => ({
                ...prev,
                permissions: ROLE_DEFAULT_PERMISSIONS[formData.name] || []
            }));
        }
    }, [formData.name, mode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePermissionToggle = (permissionId: string) => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(permissionId)
                ? prev.permissions.filter((p) => p !== permissionId)
                : [...prev.permissions, permissionId]
        }));
    };

    const handleSelectAll = () => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes("*")
                ? []
                : ["*"]
        }));
    };

    // Group permissions by category
    const permissionsByCategory = PERMISSION_OPTIONS.reduce((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, typeof PERMISSION_OPTIONS>);

    const isSystemRole = role?.is_system && mode === "edit";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {

            const url = mode === "edit" && role
                ? `/api/roles/${role.id}`
                : "/api/roles";

            const method = mode === "edit" ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description || null,
                    permissions: formData.permissions
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save role");
            }

            onSuccess();
        } catch (err: unknown) {
            console.error("Error saving role:", err);
            setError(err instanceof Error ? err.message : "Failed to save role");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/50" onClick={onClose} />

                {/* Modal */}
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {mode === "add" ? "Add New Role" : "Edit Role"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* Name */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role Name {isSystemRole && "(cannot be changed)"}
                            </label>
                            {isSystemRole ? (
                                <input
                                    type="text"
                                    value={formData.name}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-500"
                                />
                            ) : (
                                <select
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Select a role</option>
                                    {SYSTEM_ROLE_NAMES.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                    <option value="Custom">Custom Role</option>
                                </select>
                            )}
                            {mode === "add" && formData.name && !isSystemRole && (
                                <p className="mt-1 text-xs text-blue-600">
                                    Default permissions will be auto-populated. You can customize before saving.
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Describe what this role is for..."
                            />
                        </div>

                        {/* Permissions */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Permissions
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Select all non-:assigned permissions
                                            const allPerms = PERMISSION_OPTIONS.map(p => p.id);
                                            setFormData(prev => ({ ...prev, permissions: allPerms }));
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        {formData.permissions.includes("*") ? "Remove Full Access" : "Full Access (*)"}
                                    </button>
                                </div>
                            </div>

                            {formData.permissions.includes("*") ? (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">Full Access</span>
                                        <span>— This role has access to all features</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-80 overflow-y-auto p-1">
                                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                                        <div key={category}>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{category}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                                {perms.map((perm) => (
                                                    <label
                                                        key={perm.id}
                                                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.permissions.includes(perm.id)}
                                                            onChange={() => handlePermissionToggle(perm.id)}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{perm.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || isSystemRole}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {mode === "add" ? "Create Role" : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
