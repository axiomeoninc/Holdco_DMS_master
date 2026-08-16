"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

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
    subscription?: {
        plan_name: string;
        plan_price: number;
        billing_cycle: string;
        status: string;
    };
}

interface DealershipModalProps {
    mode: "add" | "edit";
    dealership: Dealership | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DealershipModal({ mode, dealership, onClose, onSuccess }: DealershipModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        business_name: "",
        business_address: "",
        business_email: "",
        business_phone: "",
        status: "Trial",
        plan_name: "Basic",
        admin_email: "",
        admin_full_name: "",
        admin_password: ""
    });

    useEffect(() => {
        if (dealership && mode === "edit") {
            setFormData({
                name: dealership.name || "",
                slug: dealership.slug || "",
                business_name: dealership.business_name || "",
                business_address: dealership.business_address || "",
                business_email: dealership.business_email || "",
                business_phone: dealership.business_phone || "",
                status: dealership.status || "Trial",
                plan_name: dealership.subscription?.plan_name || "Basic",
                admin_email: "",
                admin_full_name: "",
                admin_password: ""
            });
        }
    }, [dealership, mode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Auto-generate slug from name
        if (name === "name" && mode === "add") {
            const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            setFormData((prev) => ({ ...prev, slug }));
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {

            const url = mode === "edit" && dealership
                ? `/api/dealerships/${dealership.id}`
                : "/api/dealerships";

            const method = mode === "edit" ? "PATCH" : "POST";

            // For new dealership creation
            if (mode === "add") {
                const response = await fetch(url, {
                    method,
                    headers: {
                        "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name,
                        slug: formData.slug,
                        business_name: formData.business_name,
                        business_address: formData.business_address,
                        business_email: formData.business_email,
                        business_phone: formData.business_phone,
                        plan_name: formData.plan_name,
                        admin_email: formData.admin_email,
                        admin_full_name: formData.admin_full_name,
                        admin_password: formData.admin_password || undefined
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to create dealership");
                }
            } else {
                // For editing — dealership fields + subscription plan
                const response = await fetch(url, {
                    method,
                    headers: {
                        "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name,
                        slug: formData.slug,
                        business_name: formData.business_name,
                        business_address: formData.business_address,
                        business_email: formData.business_email,
                        business_phone: formData.business_phone,
                        status: formData.status
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to update dealership");
                }

                // Persist plan separately (subscriptions table, not dealerships columns)
                if (dealership && formData.plan_name) {
                    const planPrice =
                        formData.plan_name === "Premium"
                            ? 299
                            : formData.plan_name === "Standard"
                              ? 149
                              : 0;
                    const subRes = await fetch(
                        `/api/dealerships/${dealership.id}/subscription`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                plan_name: formData.plan_name,
                                plan_price: planPrice,
                            }),
                        }
                    );
                    if (!subRes.ok) {
                        const data = await subRes.json().catch(() => ({}));
                        throw new Error(
                            data.error || "Dealership saved but subscription plan update failed"
                        );
                    }
                }
            }

            onSuccess();
        } catch (err: unknown) {
            console.error("Error saving dealership:", err);
            setError(err instanceof Error ? err.message : "Failed to save dealership");
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
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {mode === "add" ? "Add New Dealership" : "Edit Dealership"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dealership Name *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="ABC Motors"
                            />
                        </div>

                        {/* Slug */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Slug
                            </label>
                            <input
                                type="text"
                                name="slug"
                                value={formData.slug}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="abc-motors"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Used in URLs. Auto-generated from name if empty.
                            </p>
                        </div>

                        {/* Business Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Business Name
                                </label>
                                <input
                                    type="text"
                                    name="business_name"
                                    value={formData.business_name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone
                                </label>
                                <input
                                    type="text"
                                    name="business_phone"
                                    value={formData.business_phone}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Business Email
                            </label>
                            <input
                                type="email"
                                name="business_email"
                                value={formData.business_email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Address */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Business Address
                            </label>
                            <textarea
                                name="business_address"
                                value={formData.business_address}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status (Edit mode only) */}
                        {mode === "edit" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="Trial">Trial</option>
                                    <option value="Active">Active</option>
                                    <option value="Suspended">Suspended</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                        )}

                        {/* Plan */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Plan
                            </label>
                            <select
                                name="plan_name"
                                value={formData.plan_name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="Basic">Basic (Free)</option>
                                <option value="Standard">Standard ($149/mo)</option>
                                <option value="Premium">Premium ($299/mo)</option>
                            </select>
                        </div>

                        {/* Admin User (Add mode only) */}
                        {mode === "add" && (
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-3">
                                    Initial Admin User
                                </h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Admin Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="admin_full_name"
                                            value={formData.admin_full_name}
                                            onChange={handleChange}
                                            required={mode === "add"}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="John Smith"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Admin Email *
                                        </label>
                                        <input
                                            type="email"
                                            name="admin_email"
                                            value={formData.admin_email}
                                            onChange={handleChange}
                                            required={mode === "add"}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="john@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            name="admin_password"
                                            value={formData.admin_password}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Leave blank for default password"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Default: Password@123
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {mode === "add" ? "Create Dealership" : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
