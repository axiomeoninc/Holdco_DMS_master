"use client";

import { useState, useEffect } from "react";
import {
    Flag,
    Search,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    ToggleLeft,
    ToggleRight,
    RefreshCw,
    Shield
} from "lucide-react";

interface FeatureFlag {
    id: string;
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    value_type: string;
    value: string | null;
    created_at: string;
    updated_at: string;
}

export default function FeatureFlagsPage() {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchFlags();
    }, []);

    async function fetchFlags() {
        try {
            setLoading(true);
            setError(null);

            // Check if user is platform admin
            const meResponse = await fetch("/api/me", {
            });

            if (!meResponse.ok) throw new Error("Failed to get user info");
            const meData = await meResponse.json();
            if (!meData.data?.is_platform_admin) {
                setError("You do not have permission to access this feature");
                return;
            }

            const response = await fetch("/api/platform/feature-flags", {
            });

            if (!response.ok) throw new Error("Failed to fetch feature flags");

            const data = await response.json();
            setFlags(data.data || []);
        } catch (err: unknown) {
            console.error("Error fetching feature flags:", err);
            setError(err instanceof Error ? err.message : "Failed to load feature flags");
        } finally {
            setLoading(false);
        }
    }

    async function toggleFlag(flag: FeatureFlag) {
        try {
            setUpdating(flag.key);
            setSuccess(null);
            const response = await fetch("/api/platform/feature-flags", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ key: flag.key, enabled: !flag.enabled })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to update feature flag");
            }

            // Update local state
            setFlags(prev =>
                prev.map(f =>
                    f.key === flag.key ? { ...f, enabled: !f.enabled } : f
                )
            );

            setSuccess(`${flag.name} ${!flag.enabled ? 'enabled' : 'disabled'} successfully`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            console.error("Error updating feature flag:", err);
            setError(err instanceof Error ? err.message : "Failed to update feature flag");
        } finally {
            setUpdating(null);
        }
    }

    const filteredFlags = flags.filter(flag =>
        flag.name.toLowerCase().includes(search.toLowerCase()) ||
        flag.key.toLowerCase().includes(search.toLowerCase()) ||
        flag.description?.toLowerCase().includes(search.toLowerCase())
    );

    const enabledCount = flags.filter(f => f.enabled).length;
    const disabledCount = flags.filter(f => !f.enabled).length;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Enable or disable platform-wide features
                    </p>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-amber-800">Platform Admin Only</p>
                    <p className="text-amber-700 mt-1">
                        Feature flags control platform-wide functionality. Changes take effect immediately.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <p className="text-sm text-green-600">{success}</p>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Flag className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{flags.length}</p>
                                <p className="text-xs text-gray-600">Total Features</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{enabledCount}</p>
                                <p className="text-xs text-gray-600">Enabled</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                                <XCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{disabledCount}</p>
                                <p className="text-xs text-gray-600">Disabled</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Refresh */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search feature flags..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={fetchFlags}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Feature Flags List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                ) : filteredFlags.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <Flag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No feature flags found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredFlags.map((flag) => (
                            <div
                                key={flag.id}
                                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-medium text-gray-900">{flag.name}</h3>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                flag.enabled
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                            }`}>
                                                {flag.enabled ? "Enabled" : "Disabled"}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-2">{flag.description}</p>
                                        <code className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                            {flag.key}
                                        </code>
                                    </div>
                                    <button
                                        onClick={() => toggleFlag(flag)}
                                        disabled={updating === flag.key}
                                        className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                            flag.enabled
                                                ? "bg-green-50 hover:bg-green-100"
                                                : "bg-gray-50 hover:bg-gray-100"
                                        } disabled:opacity-50`}
                                    >
                                        {updating === flag.key ? (
                                            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                        ) : flag.enabled ? (
                                            <ToggleRight className="w-6 h-6 text-green-600" />
                                        ) : (
                                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
