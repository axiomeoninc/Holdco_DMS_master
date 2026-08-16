"use client";

import { useState, useEffect } from "react";
import {
    Shield,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    AlertCircle,
    FileText,
    User,
    Building2
} from "lucide-react";

interface AuditLog {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    actor_id: string;
    actor_email: string;
    actor_role: string;
    target_id: string;
    target_email: string;
    metadata: Record<string, unknown>;
    ip_address: string;
    user_agent: string;
    created_at: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [limit, _setLimit] = useState(50);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [entityFilter, setEntityFilter] = useState("");

    useEffect(() => {
        void fetchAuditLogs();
    }, [offset, limit]);

    async function fetchAuditLogs() {
        try {
            setLoading(true);
            setError(null);

            // Check if user is platform admin
            const meResponse = await fetch("/api/me", {
            });

            if (!meResponse.ok) throw new Error("Failed to get user info");
            const meData = await meResponse.json();
            if (!meData.data?.is_platform_admin) {
                setError("You do not have permission to access audit logs");
                return;
            }

            // Build query params — free-text search maps to action ilike on API
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString()
            });
            const actionQuery = actionFilter || search.trim();
            if (actionQuery) params.set("action", actionQuery);
            if (entityFilter) params.set("entity_type", entityFilter);

            const response = await fetch(`/api/platform/audit-logs?${params}`, {
            });

            if (!response.ok) throw new Error("Failed to fetch audit logs");

            const data = await response.json();
            setLogs(data.data || []);
            setCount(data.count || 0);
        } catch (err: unknown) {
            console.error("Error fetching audit logs:", err);
            setError(err instanceof Error ? err.message : "Failed to load audit logs");
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setOffset(0);
        fetchAuditLogs();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getActionIcon = (action: string) => {
        if (action.includes("user")) return <User className="w-4 h-4" />;
        if (action.includes("dealership")) return <Building2 className="w-4 h-4" />;
        return <FileText className="w-4 h-4" />;
    };

    const getActionColor = (action: string) => {
        if (action.includes("delete") || action.includes("suspend")) return "text-red-600 bg-red-50";
        if (action.includes("create") || action.includes("activate")) return "text-green-600 bg-green-50";
        if (action.includes("update") || action.includes("edit")) return "text-blue-600 bg-blue-50";
        return "text-gray-600 bg-gray-50";
    };

    const totalPages = Math.ceil(count / limit);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Read-only log of platform admin actions (no edit or Save)
                    </p>
                </div>
                <button
                    onClick={fetchAuditLogs}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <form onSubmit={handleSearch} className="mt-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by action..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Actions</option>
                    <option value="user">User Actions</option>
                    <option value="dealership">Dealership Actions</option>
                    <option value="platform">Platform Actions</option>
                </select>
                <select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Entities</option>
                    <option value="user">User</option>
                    <option value="dealership">Dealership</option>
                    <option value="deal">Deal</option>
                    <option value="vehicle">Vehicle</option>
                </select>
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    Filter
                </button>
            </form>

            {/* Content */}
            <div className="p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Stats */}
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Total Logs</p>
                        <p className="text-2xl font-bold text-gray-900">{count}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Showing</p>
                        <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Offset</p>
                        <p className="text-2xl font-bold text-gray-900">{offset + 1}-{Math.min(offset + limit, count)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Page</p>
                        <p className="text-2xl font-bold text-gray-900">{Math.floor(offset / limit) + 1} / {totalPages || 1}</p>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Shield className="w-12 h-12 text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No audit logs found</h3>
                            <p className="text-sm text-gray-500">No actions have been recorded yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`p-1.5 rounded ${getActionColor(log.action)}`}>
                                                        {getActionIcon(log.action)}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{log.action}</p>
                                                        <p className="text-xs text-gray-500">{log.entity_type}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-900">{log.actor_email || "System"}</p>
                                                <p className="text-xs text-gray-500">{log.actor_role || "—"}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-900">{log.target_email || log.target_id || "—"}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-900">{formatDate(log.created_at)}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-500 font-mono">{log.ip_address || "—"}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {logs.length > 0 && (
                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            Showing {offset + 1} to {Math.min(offset + limit, count)} of {count} results
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setOffset(Math.max(0, offset - limit))}
                                disabled={offset === 0}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <button
                                onClick={() => setOffset(offset + limit)}
                                disabled={offset + limit >= count}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
