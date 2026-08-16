"use client";

import { useEffect, useState } from "react";
import {
    Loader2,
    AlertCircle,
    Archive,
    Download,
    FileText,
    ShieldCheck,
    FileCheck2,
} from "lucide-react";

interface ExportRow {
    id: string;
    archive_type: string;
    status: string;
    file_name: string | null;
    file_size_bytes: number | null;
    row_counts: unknown;
    requested_by: string | null;
    created_at: string;
}

function fmtBytes(bytes: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

export default function RetentionPage() {
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<ExportRow[]>([]);
    const [dealId, setDealId] = useState("");
    const [vehicleId, setVehicleId] = useState("");
    const [packing, setPacking] = useState(false);
    const [packDone, setPackDone] = useState(false);

    async function loadHistory() {
        try {
            const res = await fetch("/api/retention/export");
            if (res.ok) {
                const json = await res.json();
                setHistory(json.data || []);
            }
        } catch {
            // history is a nice-to-have
        }
    }

    useEffect(() => {
        // Load export history on mount (nice-to-have; failures are ignored).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadHistory();
    }, []);

    async function handleFullExport() {
        setError(null);
        setExporting(true);
        try {
            const res = await fetch("/api/retention/export", { method: "POST" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Export failed (${res.status})`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition") || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match?.[1] || "flashfender-retention-export.json";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            await loadHistory();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Export failed");
        } finally {
            setExporting(false);
        }
    }

    async function handleCompliancePack() {
        setError(null);
        setPackDone(false);
        if (!dealId.trim() && !vehicleId.trim()) {
            setError("Enter a deal ID or a vehicle ID to generate the pack.");
            return;
        }
        setPacking(true);
        try {
            const params = new URLSearchParams();
            if (dealId.trim()) params.set("deal_id", dealId.trim());
            if (vehicleId.trim()) params.set("vehicle_id", vehicleId.trim());
            const res = await fetch(`/api/compliance-pack?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Compliance pack failed (${res.status})`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition") || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match?.[1] || "compliance-pack.pdf";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setPackDone(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Compliance pack failed");
        } finally {
            setPacking(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <Archive className="h-6 w-6 text-blue-600" />
                        Retention &amp; Compliance
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        10-year retention export + compliance document pack.
                    </p>
                </div>
            </div>

            <div className="px-6 py-6">
                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {packDone && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                        <FileCheck2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                        Compliance pack downloaded.
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        {/* Retention export */}
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                    <Archive className="h-5 w-5 text-blue-600" />
                                    10-Year Retention Export
                                </h2>
                            </div>
                            <div className="p-6">
                                <p className="mb-4 text-sm text-gray-600">
                                    Generate a portable, versioned JSON bundle of
                                    your full dealership record: inventory,
                                    customers, deals, invoices, quotations,
                                    bills of sale, expenses, purchases, ledger,
                                    audit trail, e-signatures and payment
                                    records. FlashFender keeps records for 10
                                    years — this is your copy, anytime.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void handleFullExport()}
                                    disabled={exporting}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {exporting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Building export…
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4" />
                                            Download full retention export
                                        </>
                                    )}
                                </button>

                                {history.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="mb-2 text-sm font-medium text-gray-500">
                                            Export history
                                        </h3>
                                        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                                            {history.slice(0, 10).map((row) => (
                                                <li
                                                    key={row.id}
                                                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                                                >
                                                    <span className="text-gray-700">
                                                        {row.file_name || "Export"}
                                                    </span>
                                                    <span className="flex items-center gap-3 text-xs text-gray-400">
                                                        <span>{fmtBytes(row.file_size_bytes)}</span>
                                                        <span>{fmtTime(row.created_at)}</span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Compliance pack */}
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    Compliance Document Pack
                                </h2>
                            </div>
                            <div className="p-6">
                                <p className="mb-4 text-sm text-gray-600">
                                    Generates a single PDF with the We Owe,
                                    Buyer&apos;s Guide and Known-Damage
                                    Disclosure for a deal or vehicle. Known
                                    damage must have disclosure notes recorded
                                    (MVDA) before the pack can be generated.
                                </p>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">
                                            Deal ID
                                        </label>
                                        <input
                                            type="text"
                                            value={dealId}
                                            onChange={(e) => setDealId(e.target.value)}
                                            placeholder="Deal UUID"
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">
                                            or Vehicle ID
                                        </label>
                                        <input
                                            type="text"
                                            value={vehicleId}
                                            onChange={(e) => setVehicleId(e.target.value)}
                                            placeholder="Vehicle UUID"
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleCompliancePack()}
                                    disabled={packing}
                                    className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
                                >
                                    {packing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Generating…
                                        </>
                                    ) : (
                                        <>
                                            <FileCheck2 className="h-4 w-4" />
                                            Generate compliance pack
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                                <ShieldCheck className="h-4 w-4" />
                                What&apos;s included
                            </h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• Full dealership data export (JSON)</li>
                                <li>• We Owe / Buyer&apos;s Guide / Known-Damage pack</li>
                                <li>• Immutable audit trail (see Audit Trail)</li>
                                <li>• 10-year retention policy</li>
                            </ul>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-3 text-sm font-medium text-gray-500">
                                Related
                            </h3>
                            <div className="space-y-2">
                                <a
                                    href="/settings/audit"
                                    className="block rounded-lg border border-gray-200 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                                >
                                    Audit Trail →
                                </a>
                                <a
                                    href="/settings/accounting"
                                    className="block rounded-lg border border-gray-200 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                                >
                                    Accounting Export →
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
