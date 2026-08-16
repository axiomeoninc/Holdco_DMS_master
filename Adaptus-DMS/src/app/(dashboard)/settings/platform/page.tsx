"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Settings,
    Building2,
    Users,
    CreditCard,
    Globe,
    Shield,
    Mail,
    Database,
    Loader2,
    AlertCircle,
    RefreshCw,
    Key,
    Flag,
    ExternalLink,
} from "lucide-react";

interface PlatformStats {
    total_dealerships: number;
    active_dealerships: number;
    trial_dealerships: number;
    suspended_dealerships: number;
    total_users: number;
    total_revenue: number;
}

type DbStatus = "not_probed" | "healthy" | "unreachable";

/** Display-only defaults — no persistence API exists for these fields. */
const DISPLAY_SETTINGS = {
    platform_name: "AdaptUs DMS",
    platform_email: "admin@adaptus.com",
    support_email: "support@adaptus.com",
    maintenance_mode: false,
    registration_enabled: true,
    require_email_verification: true,
    default_plan: "Basic",
    trial_days: 14,
} as const;

export default function PlatformSettingsPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dbStatus, setDbStatus] = useState<DbStatus>("not_probed");

    useEffect(() => {
        void fetchPlatformData();
    }, []);

    async function fetchPlatformData() {
        try {
            setLoading(true);
            setError(null);
            setDbStatus("not_probed");

            const meResponse = await fetch("/api/me", {});

            if (!meResponse.ok) {
                throw new Error("Failed to get user info");
            }

            const meData = await meResponse.json();

            if (!meData.data.is_platform_admin) {
                setError("You do not have permission to access platform settings");
                return;
            }

            // Probe API liveness + authenticated dealerships read as DB health signal
            const [healthSettled, dealershipsSettled] = await Promise.allSettled([
                fetch("/api/health", { cache: "no-store" }),
                fetch("/api/dealerships", {}),
            ]);

            const healthOk =
                healthSettled.status === "fulfilled" && healthSettled.value.ok;
            const dealershipsResponse =
                dealershipsSettled.status === "fulfilled"
                    ? dealershipsSettled.value
                    : null;

            if (dealershipsResponse?.ok) {
                setDbStatus("healthy");
                const data = await dealershipsResponse.json();
                const dealerships = data.data || [];

                setStats({
                    total_dealerships: dealerships.length,
                    active_dealerships: dealerships.filter(
                        (d: { status?: string }) => d.status === "Active"
                    ).length,
                    trial_dealerships: dealerships.filter(
                        (d: { status?: string }) => d.status === "Trial"
                    ).length,
                    suspended_dealerships: dealerships.filter(
                        (d: { status?: string }) => d.status === "Suspended"
                    ).length,
                    total_users: dealerships.reduce(
                        (sum: number, d: { user_count?: number }) =>
                            sum + (d.user_count || 0),
                        0
                    ),
                    total_revenue: dealerships.reduce(
                        (
                            sum: number,
                            d: { subscription?: { plan_price?: number } }
                        ) => {
                            const price = d.subscription?.plan_price || 0;
                            return sum + price;
                        },
                        0
                    ),
                });
            } else if (!healthOk) {
                setDbStatus("unreachable");
            } else {
                // Service up but dealership query failed — treat as unreachable DB path
                setDbStatus("unreachable");
            }
        } catch (err: unknown) {
            console.error("Error fetching platform data:", err);
            setDbStatus("unreachable");
            setError(
                err instanceof Error ? err.message : "Failed to load platform data"
            );
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-500">{error}</p>
                </div>
            </div>
        );
    }

    const s = DISPLAY_SETTINGS;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Platform overview and read-only defaults
                    </p>
                </div>
                <button
                    onClick={fetchPlatformData}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            <div className="px-6 py-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-sm text-slate-800 font-medium">Read-only — not persisted</p>
                    <p className="text-sm text-slate-600 mt-1">
                        There is no platform-settings save API. Branding, maintenance mode, trial
                        days, and registration toggles below are display defaults only. Runtime
                        feature toggles live on{" "}
                        <Link
                            href="/platform/feature-flags"
                            className="text-blue-600 hover:underline font-medium"
                        >
                            Feature Flags
                        </Link>
                        .
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <Settings className="w-5 h-5 text-gray-500" />
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        General (defaults)
                                    </h2>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Platform Name
                                    </label>
                                    <input
                                        type="text"
                                        value={s.platform_name}
                                        readOnly
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Platform Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="email"
                                            value={s.platform_email}
                                            readOnly
                                            disabled
                                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Support Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="email"
                                            value={s.support_email}
                                            readOnly
                                            disabled
                                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5 text-gray-500" />
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Registration & Access (defaults)
                                    </h2>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {(
                                    [
                                        {
                                            label: "Allow New Dealerships",
                                            hint: "Let new dealerships register on the platform",
                                            on: s.registration_enabled,
                                        },
                                        {
                                            label: "Require Email Verification",
                                            hint: "New users must verify their email",
                                            on: s.require_email_verification,
                                        },
                                        {
                                            label: "Maintenance Mode",
                                            hint: "Disable platform access for all users",
                                            on: s.maintenance_mode,
                                            danger: true,
                                        },
                                    ] as const
                                ).map((row) => (
                                    <div
                                        key={row.label}
                                        className="flex items-center justify-between opacity-80"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{row.label}</p>
                                            <p className="text-sm text-gray-500">{row.hint}</p>
                                        </div>
                                        <span
                                            className={`relative w-12 h-6 rounded-full ${
                                                row.on
                                                    ? "danger" in row && row.danger
                                                        ? "bg-red-600"
                                                        : "bg-blue-600"
                                                    : "bg-gray-300"
                                            }`}
                                            aria-hidden
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full ${
                                                    row.on ? "translate-x-6" : ""
                                                }`}
                                            />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5 text-gray-500" />
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Subscription Defaults
                                    </h2>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Default Plan for New Dealerships
                                    </label>
                                    <input
                                        type="text"
                                        value={`${s.default_plan} (Free)`}
                                        readOnly
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Trial Period (Days)
                                    </label>
                                    <input
                                        type="number"
                                        value={s.trial_days}
                                        readOnly
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/platform/feature-flags"
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Flag className="w-4 h-4" />
                                Open Feature Flags
                                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                            </Link>
                            <p className="text-xs text-gray-500">
                                No Save button — nothing on this page writes to the database.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-gray-500" />
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        Platform Overview
                                    </h3>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Total Dealerships</span>
                                    <span className="font-semibold text-gray-900">
                                        {stats?.total_dealerships || 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Active</span>
                                    <span className="font-semibold text-green-600">
                                        {stats?.active_dealerships || 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Trial</span>
                                    <span className="font-semibold text-blue-600">
                                        {stats?.trial_dealerships || 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Suspended</span>
                                    <span className="font-semibold text-red-600">
                                        {stats?.suspended_dealerships || 0}
                                    </span>
                                </div>
                                <div className="border-t border-gray-200 pt-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Total Users</span>
                                        <span className="font-semibold text-gray-900">
                                            {stats?.total_users || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="border-t border-gray-200 pt-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Monthly Revenue</span>
                                        <span className="font-semibold text-gray-900">
                                            {formatCurrency(stats?.total_revenue || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-4">Quick Links</h3>
                            <div className="space-y-2">
                                <a
                                    href="/dealerships"
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <Building2 className="w-4 h-4" />
                                    Manage Dealerships
                                </a>
                                <a
                                    href="/platform/subscriptions"
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Subscriptions
                                </a>
                                <a
                                    href="/users"
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <Users className="w-4 h-4" />
                                    All Users
                                </a>
                                <Link
                                    href="/platform/feature-flags"
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <Flag className="w-4 h-4" />
                                    Feature Flags
                                </Link>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-4">Security</h3>
                            <div className="space-y-3">
                                <a
                                    href="/settings/integrations"
                                    className="flex items-center justify-between w-full text-sm hover:text-blue-600"
                                >
                                    <span className="text-gray-600">API Keys / Integrations</span>
                                    <Key className="w-4 h-4 text-gray-400" />
                                </a>
                                <Link
                                    href="/platform/audit-logs"
                                    className="flex items-center justify-between w-full text-sm hover:text-blue-600"
                                >
                                    <span className="text-gray-600">Audit Logs</span>
                                    <Shield className="w-4 h-4 text-gray-400" />
                                </Link>
                                <p className="text-xs text-gray-400 pt-1">
                                    Audit logs are read-only from existing{" "}
                                    <code className="text-[10px]">audit_logs</code> records.
                                    Notification delivery settings are not configurable yet; the
                                    header bell shows overdue invoices, due follow-ups, and tasks.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-4">System</h3>
                            <div className="flex items-center gap-3">
                                <Database className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Database Status</p>
                                    {dbStatus === "healthy" ? (
                                        <p className="text-xs text-green-600">Healthy (probed)</p>
                                    ) : dbStatus === "unreachable" ? (
                                        <p className="text-xs text-red-600">Unreachable</p>
                                    ) : (
                                        <p className="text-xs text-amber-600">Not probed</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
