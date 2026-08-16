"use client";

import { useState, useEffect } from "react";
import {
    X,
    User,
    Mail,
    Phone,
    Calendar,
    Shield,
    Save,
    Loader2,
    AlertCircle,
    UserPlus,
    Users,
    Eye,
    EyeOff,
    Key,
    Check,
    ChevronDown,
    ChevronRight,
} from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

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
    user_permissions?: string[];
}

interface UserFormModalProps {
    mode: "add" | "edit";
    user?: User | null;
    targetDealershipId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

// Default permissions by role (used to auto-populate)
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
    Admin: ["*"],
    Manager: [
        "dashboard:read", "dashboard:write",
        "leads:read", "leads:write", "leads:delete", "leads:assign",
        "test_drives:read", "test_drives:write", "test_drives:delete",
        "deals:read", "deals:write", "deals:delete",
        "follow_ups:read", "follow_ups:write", "follow_ups:delete",
        "vehicles:read", "vehicles:write", "vehicles:delete", "vehicles:pricing", "vehicles:photos", "vehicles:carfax",
        "customers:read", "customers:write", "customers:delete",
        "invoices:read", "invoices:write", "invoices:delete",
        "expenses:read", "expenses:write", "expenses:delete",
        "vendors:read", "vendors:write",
        "reports:read", "reports:write", "reports:export",
        "users:read", "users:write",
        "tasks:read", "tasks:write", "tasks:delete", "tasks:assign",
        "tickets:read", "tickets:write", "tickets:delete",
        "tools:read", "tools:write",
        "settings:read", "settings:write",
        "profile:read", "profile:write",
    ],
    Salesperson: [
        "dashboard:read",
        "leads:read:assigned", "leads:write",
        "test_drives:read:assigned", "test_drives:write",
        "deals:read:assigned",
        "follow_ups:read:assigned", "follow_ups:write",
        "vehicles:read",
        "customers:read:assigned", "customers:write",
        "tasks:read:assigned", "tasks:write",
        "tools:read",
        "profile:read", "profile:write",
    ],
    Staff: [
        "dashboard:read",
        "leads:read:assigned", "leads:write",
        "test_drives:read:assigned", "test_drives:write",
        "deals:read:assigned",
        "follow_ups:read:assigned", "follow_ups:write",
        "vehicles:read",
        "customers:read:assigned", "customers:write",
        "tasks:read:assigned", "tasks:write",
        "tools:read",
        "profile:read", "profile:write",
    ]
};

// Available permissions grouped by category
const PERMISSIONS = {
    dashboard: {
        label: "Dashboard",
        permissions: [
            { key: "dashboard:read", label: "View Dashboard" },
            { key: "dashboard:write", label: "Edit Dashboard" },
        ]
    },
    leads: {
        label: "Leads",
        permissions: [
            { key: "leads:read", label: "View All Leads" },
            { key: "leads:read:assigned", label: "View Assigned Leads Only" },
            { key: "leads:write", label: "Add/Edit Leads" },
            { key: "leads:delete", label: "Delete Leads" },
            { key: "leads:assign", label: "Assign Leads" },
        ]
    },
    test_drives: {
        label: "Test Drives",
        permissions: [
            { key: "test_drives:read", label: "View All Test Drives" },
            { key: "test_drives:read:assigned", label: "View Assigned Test Drives Only" },
            { key: "test_drives:write", label: "Schedule/Edit Test Drives" },
            { key: "test_drives:delete", label: "Delete Test Drives" },
        ]
    },
    deals: {
        label: "Deals",
        permissions: [
            { key: "deals:read", label: "View All Deals" },
            { key: "deals:read:assigned", label: "View Assigned Deals Only" },
            { key: "deals:write", label: "Add/Edit Deals" },
            { key: "deals:delete", label: "Delete Deals" },
            { key: "deals:close", label: "Close/Cancel Deals" },
        ]
    },
    customers: {
        label: "Customers",
        permissions: [
            { key: "customers:read", label: "View All Customers" },
            { key: "customers:read:assigned", label: "View Assigned Customers Only" },
            { key: "customers:write", label: "Add/Edit Customers" },
            { key: "customers:delete", label: "Delete Customers" },
        ]
    },
    vehicles: {
        label: "Vehicles / Inventory",
        permissions: [
            { key: "vehicles:read", label: "View Vehicles" },
            { key: "vehicles:write", label: "Add/Edit Vehicles" },
            { key: "vehicles:delete", label: "Delete Vehicles" },
            { key: "vehicles:pricing", label: "Manage Pricing" },
            { key: "vehicles:photos", label: "Manage Photos" },
            { key: "vehicles:carfax", label: "Upload Carfax" },
        ]
    },
    invoices: {
        label: "Invoices",
        permissions: [
            { key: "invoices:read", label: "View Invoices" },
            { key: "invoices:write", label: "Create/Edit Invoices" },
            { key: "invoices:delete", label: "Delete Invoices" },
        ]
    },
    expenses: {
        label: "Expenses",
        permissions: [
            { key: "expenses:read", label: "View Expenses" },
            { key: "expenses:write", label: "Create/Edit Expenses" },
            { key: "expenses:delete", label: "Delete Expenses" },
        ]
    },
    vendors: {
        label: "Vendors",
        permissions: [
            { key: "vendors:read", label: "View Vendors" },
            { key: "vendors:write", label: "Create/Edit Vendors" },
        ]
    },
    reports: {
        label: "Reports",
        permissions: [
            { key: "reports:read", label: "View Reports" },
            { key: "reports:write", label: "Create Reports" },
            { key: "reports:export", label: "Export Reports" },
        ]
    },
    users: {
        label: "Users",
        permissions: [
            { key: "users:read", label: "View Users" },
            { key: "users:write", label: "Create/Edit Users" },
            { key: "users:delete", label: "Delete Users" },
        ]
    },
    tasks: {
        label: "Tasks",
        permissions: [
            { key: "tasks:read", label: "View All Tasks" },
            { key: "tasks:read:assigned", label: "View Assigned Tasks Only" },
            { key: "tasks:write", label: "Create/Edit Tasks" },
            { key: "tasks:delete", label: "Delete Tasks" },
            { key: "tasks:assign", label: "Assign Tasks" },
        ]
    },
    tickets: {
        label: "Support Tickets",
        permissions: [
            { key: "tickets:read", label: "View All Tickets" },
            { key: "tickets:read:assigned", label: "View Assigned Tickets Only" },
            { key: "tickets:write", label: "Create/Edit Tickets" },
            { key: "tickets:delete", label: "Delete Tickets" },
        ]
    },
    follow_ups: {
        label: "Follow-ups",
        permissions: [
            { key: "follow_ups:read", label: "View All Follow-ups" },
            { key: "follow_ups:read:assigned", label: "View Assigned Follow-ups Only" },
            { key: "follow_ups:write", label: "Create/Edit Follow-ups" },
            { key: "follow_ups:delete", label: "Delete Follow-ups" },
        ]
    },
    tools: {
        label: "Tools",
        permissions: [
            { key: "tools:read", label: "Access Tools" },
            { key: "tools:write", label: "Configure Tools" },
        ]
    },
    settings: {
        label: "Settings",
        permissions: [
            { key: "settings:read", label: "View Settings" },
            { key: "settings:write", label: "Edit Settings" },
        ]
    },
    profile: {
        label: "Profile",
        permissions: [
            { key: "profile:read", label: "View Profile" },
            { key: "profile:write", label: "Edit Profile" },
        ]
    }
};

export default function UserFormModal({
    mode,
    user,
    targetDealershipId,
    onClose,
    onSuccess
}: UserFormModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showPermissions, setShowPermissions] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(["leads", "deals", "customers", "tasks"]);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        phone: "",
        role: "Staff",
        start_date: new Date().toISOString().split('T')[0],
        password: "",
        avatar: ""
    });

    useEffect(() => {
        if (mode === "edit" && user) {
            setFormData({
                full_name: user.full_name,
                email: user.email,
                phone: user.phone || "",
                role: user.role,
                start_date: user.start_date,
                password: "",
                avatar: user.avatar || ""
            });
            setSelectedPermissions(user.user_permissions || []);
        }
    }, [mode, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));

        // Auto-populate permissions when role changes in add mode
        if (name === "role" && mode === "add") {
            const defaultPerms = ROLE_DEFAULT_PERMISSIONS[value] || [];
            setSelectedPermissions(defaultPerms);
        }
    };

    const togglePermission = (permissionKey: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionKey)
                ? prev.filter(p => p !== permissionKey)
                : [...prev, permissionKey]
        );
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const selectAllInCategory = (category: string) => {
        const categoryPerms = PERMISSIONS[category as keyof typeof PERMISSIONS]?.permissions.map(p => p.key) || [];
        const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));
        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
        } else {
            setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])]);
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const url = mode === "add" ? "/api/users" : `/api/users/${user?.id}`;
            const method = mode === "add" ? "POST" : "PATCH";

            const payload = mode === "add"
                ? {
                    full_name: formData.full_name,
                    email: formData.email,
                    phone: formData.phone || null,
                    role: formData.role,
                    start_date: formData.start_date,
                    password: formData.password || undefined,
                    avatar: formData.avatar || null,
                    target_dealership_id: targetDealershipId || undefined,
                    user_permissions: selectedPermissions
                }
                : {
                    full_name: formData.full_name,
                    phone: formData.phone || null,
                    role: formData.role,
                    start_date: formData.start_date,
                    avatar: formData.avatar || null,
                    user_permissions: selectedPermissions
                };

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${mode} user`);
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "Admin":
                return <Shield className="w-4 h-4" />;
            case "Manager":
                return <User className="w-4 h-4" />;
            default:
                return <Users className="w-4 h-4" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                {mode === "add" ? (
                                    <UserPlus className="w-5 h-5 text-white" />
                                ) : (
                                    <Users className="w-5 h-5 text-white" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {mode === "add" ? "Add New User" : "Edit User"}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {mode === "add" ? "Add a new team member" : "Update user information and permissions"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6">
                        {/* Error Alert */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Full Name *
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        name="full_name"
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Email *
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="john@dealership.com"
                                        required
                                        disabled={mode === "edit"}
                                    />
                                </div>
                                {mode === "edit" && (
                                    <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
                                )}
                            </div>

                            {/* Password (Add mode only) */}
                            {mode === "add" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Leave empty for auto-generated"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-400">
                                        Default: Password@123 (if left empty)
                                    </p>
                                </div>
                            )}

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Phone
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="+1 234 567 8900"
                                    />
                                </div>
                            </div>

                            {/* Role and Start Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Role *
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            {getRoleIcon(formData.role)}
                                        </div>
                                        <select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            required
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Manager">Manager</option>
                                            <option value="Staff">Staff</option>
                                            <option value="Salesperson">Salesperson</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Start Date *
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="date"
                                            name="start_date"
                                            value={formData.start_date}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Avatar URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Avatar URL
                                </label>
                                <input
                                    type="url"
                                    name="avatar"
                                    value={formData.avatar}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="https://example.com/avatar.jpg"
                                />
                            </div>

                            {/* Individual Permissions Section */}
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowPermissions(!showPermissions)}
                                    className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-gray-900">Individual Permissions</span>
                                        <span className="text-xs text-gray-500">({selectedPermissions.length} selected)</span>
                                    </div>
                                    {showPermissions ? (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>

                                {showPermissions && (
                                    <div className="p-4 space-y-3">
                                        <p className="text-xs text-gray-500 mb-3">
                                            Grant specific permissions beyond the role defaults. Role permissions are auto-populated when you select a role. Use this to add or remove specific permissions.
                                        </p>

                                        {Object.entries(PERMISSIONS).map(([categoryKey, category]) => {
                                            const categoryPerms = category.permissions.map(p => p.key);
                                            const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));

                                            return (
                                                <div key={categoryKey} className="border border-gray-100 rounded-lg overflow-hidden">
                                                    <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCategory(categoryKey)}
                                                            className="flex items-center gap-2 text-sm font-medium text-gray-700"
                                                        >
                                                            {expandedCategories.includes(categoryKey) ? (
                                                                <ChevronDown className="w-4 h-4" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4" />
                                                            )}
                                                            {category.label}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => selectAllInCategory(categoryKey)}
                                                            className="text-xs text-blue-600 hover:text-blue-700"
                                                        >
                                                            {allSelected ? "Deselect All" : "Select All"}
                                                        </button>
                                                    </div>
                                                    {expandedCategories.includes(categoryKey) && (
                                                        <div className="p-3 space-y-2">
                                                            {category.permissions.map(permission => (
                                                                <label
                                                                    key={permission.key}
                                                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                                                >
                                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                                        selectedPermissions.includes(permission.key)
                                                                            ? "bg-blue-600 border-blue-600"
                                                                            : "border-gray-300"
                                                                    }`}>
                                                                        {selectedPermissions.includes(permission.key) && (
                                                                            <Check className="w-3 h-3 text-white" />
                                                                        )}
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedPermissions.includes(permission.key)}
                                                                        onChange={() => togglePermission(permission.key)}
                                                                        className="sr-only"
                                                                    />
                                                                    <span className="text-sm text-gray-700">{permission.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {mode === "add" ? "Adding..." : "Saving..."}
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            {mode === "add" ? "Add User" : "Save Changes"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
