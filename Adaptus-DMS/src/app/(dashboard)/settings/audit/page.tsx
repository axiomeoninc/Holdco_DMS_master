"use client";

import { useEffect, useState } from "react";
import {
    Loader2,
    AlertCircle,
    RefreshCw,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface AuditRow {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_email: string | null;
    actor_role: string | null;
    metadata: unknown;
    ip_address: string | null;
    dealership_id: string | null;
    created_at: string;
}

const ENTITY_TYPES = [
    "",
    "deal",
    "vehicle",
    "lead",
    "customer",
    "invoice",
    "bill_of_sale",
    "quotation",
    "settings",
    "payment",
    "document",
    "retention_export",
];

function fmtTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString("en-CA", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return iso;
    }
}

function entityLabel(type: string): string {
    const map: Record<string, string> = {
        deal: "Deal",
        vehicle: "Inventory",
        lead: "Lead",
        customer: "Customer",
        invoice: "Invoice",
        bill_of_sale: "Bill of Sale",
        quotation: "Quotation",
        settings: "Settings",
        payment: "Payment",
        document: "Document",
        retention_export: "Retention",
    };
    return map[type] || type;
}

export default function AuditLogPage() {
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [entityType, setEntityType] = useState("");
    const [action, setAction] = useState("");
    const [offset, setOffset] = useState(0);
    const LIMIT = 50;

    async function fetchLogs() {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
            if (entityType) params.set("entity_type", entityType);
            if (action.trim()) params.set("action", action.trim());
            const res = await fetch(`/api/audit-logs?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Failed to load audit log (${res.status})`);
            }
            const json = await res.json();
            setRows(json.data || []);
            setCount(json.count || 0);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load audit log");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // Data-fetch on filter/page change; refetch is intentional.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, entityType]);

    const applyActionFilter = () => {
        setOffset(0);
        void fetchLogs();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <ShieldCheck className="h-6 w-6 text-blue-600" />
                        Audit Trail
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Your dealership&apos;s immutable activity log — deals,
                        inventory, leads, settings and payments.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchLogs()}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            <div className="px-6 py-6">
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-medium">Read-only and immutable</p>
                    <p className="mt-0.5 text-xs text-amber-900/90">
                        Audit entries cannot be edited or deleted — they are
                        retained for 10 years as part of your retention policy.
                        Platform admins retain separate visibility.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <div>
                        <label
                            htmlFor="entity-type"
                            className="mb-1 block text-xs font-medium text-gray-500"
                        >
                            Entity type
                        </label>
                        <select
                            id="entity-type"
                            value={entityType}
                            onChange={(e) => {
                                setEntityType(e.target.value);
                                setOffset(0);
                                void fetchLogs();
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                        >
                            {ENTITY_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t ? entityLabel(t) : "All types"}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                            Action contains
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={action}
                                onChange={(e) => setAction(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") applyActionFilter();
                                }}
                                placeholder="e.g. deal.close"
                                className="w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                            />
                            <button
                                type="button"
                                onClick={applyActionFilter}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                Filter
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="py-16 text-center">
                            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                            <p className="text-gray-500">No audit events found</p>
                            <p className="text-xs text-gray-400">
                                Deal, inventory, lead, settings and payment
                                changes appear here.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {rows.map((row) => (
                                <li key={row.id} className="flex items-start gap-4 px-6 py-4">
                                    <div className="mt-0.5 flex h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            {row.action}
                                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal uppercase text-gray-500">
                                                {entityLabel(row.entity_type)}
                                            </span>
                                        </p>
                                        <p className="mt-0.5 truncate font-mono text-xs text-gray-400">
                                            {row.entity_id || "—"}
                                        </p>
                                        {row.metadata &&
                                        typeof row.metadata === "object" &&
                                        Object.keys(row.metadata as object).length ? (
                                            <p className="mt-1 truncate text-xs text-gray-500">
                                                {JSON.stringify(row.metadata)}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <p className="text-xs text-gray-500">
                                            {fmtTime(row.created_at)}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-400">
                                            {row.actor_email || "system"}
                                            {row.actor_role ? ` · ${row.actor_role}` : ""}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {count > LIMIT && (
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                        <button
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Newer
                        </button>
                        <span>
                            {offset + 1}–{Math.min(offset + LIMIT, count)} of {count}
                        </span>
                        <button
                            type="button"
                            disabled={offset + LIMIT >= count}
                            onClick={() => setOffset((o) => o + LIMIT)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40"
                        >
                            Older
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
