"use client";

import { useState, useEffect } from "react";
import {
    CreditCard,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle
} from "lucide-react";

interface Subscription {
    id: string;
    dealership_id: string;
    plan_name: string;
    plan_price: number;
    billing_cycle: string;
    status: string;
    trial_ends_at: string;
    current_period_start: string;
    current_period_end: string;
    created_at: string;
    dealership: {
        id: string;
        name: string;
        business_email: string;
        status: string;
    };
}

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [planFilter, setPlanFilter] = useState("");

    useEffect(() => {
        fetchSubscriptions();
    }, [statusFilter, planFilter]);

    async function fetchSubscriptions() {
        try {
            setLoading(true);
            setError(null);

            // Check if user is platform admin
            const meResponse = await fetch("/api/me", {
            });

            if (!meResponse.ok) throw new Error("Failed to get user info");
            const meData = await meResponse.json();
            if (!meData.data?.is_platform_admin) {
                setError("You do not have permission to access this page");
                return;
            }

            // Build query params
            const params = new URLSearchParams({ limit: "100" });
            if (statusFilter) params.set("status", statusFilter);
            if (planFilter) params.set("plan", planFilter);

            const response = await fetch(`/api/platform/subscriptions?${params}`, {
            });

            if (!response.ok) throw new Error("Failed to fetch subscriptions");

            const data = await response.json();
            setSubscriptions(data.data || []);
            setCount(data.count || 0);
        } catch (err: unknown) {
            console.error("Error fetching subscriptions:", err);
            setError(err instanceof Error ? err.message : "Failed to load subscriptions");
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Active":
                return "text-green-700 bg-green-50";
            case "Trial":
                return "text-blue-700 bg-blue-50";
            case "PastDue":
                return "text-amber-700 bg-amber-50";
            case "Suspended":
                return "text-red-700 bg-red-50";
            case "Cancelled":
                return "text-gray-700 bg-gray-100";
            default:
                return "text-gray-700 bg-gray-50";
        }
    };

    const totalRevenue = subscriptions
        .filter((s) => s.status === "Active")
        .reduce((sum, s) => sum + (s.plan_price || 0), 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage all dealership subscriptions across the platform
                    </p>
                </div>
                <button
                    onClick={fetchSubscriptions}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="PastDue">Past Due</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Plans</option>
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                </select>
            </div>

            {/* Content */}
            <div className="p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Stats */}
                <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Total Subscriptions</p>
                        <p className="text-2xl font-bold text-gray-900">{count}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Active</p>
                        <p className="text-2xl font-bold text-green-600">
                            {subscriptions.filter((s) => s.status === "Active").length}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Trial</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {subscriptions.filter((s) => s.status === "Trial").length}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Monthly Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                    </div>
                </div>

                {/* Subscriptions Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                    ) : subscriptions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <CreditCard className="w-12 h-12 text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No subscriptions found</h3>
                            <p className="text-sm text-gray-500">No subscriptions match your filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealership</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billing</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {subscriptions.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-gray-900">{sub.dealership?.name || "Unknown"}</p>
                                                <p className="text-xs text-gray-500">{sub.dealership?.business_email || "—"}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-gray-900">{sub.plan_name}</p>
                                                <p className="text-xs text-gray-500">{formatCurrency(sub.plan_price)}/{sub.billing_cycle}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-900 capitalize">{sub.billing_cycle}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(sub.status)}`}>
                                                    {sub.status === "Active" && <CheckCircle className="w-3 h-3 mr-1" />}
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-900">{formatDate(sub.current_period_end)}</p>
                                                {sub.trial_ends_at && sub.status === "Trial" && (
                                                    <p className="text-xs text-blue-600">Trial ends: {formatDate(sub.trial_ends_at)}</p>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
