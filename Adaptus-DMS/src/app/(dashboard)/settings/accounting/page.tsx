"use client";

import { useState, useEffect, useCallback } from "react";
import {
    FileSpreadsheet,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Download,
    FileText,
} from "lucide-react";

interface DealershipInfo {
    id: string;
    name: string;
}

const FORMATS = [
    {
        value: "quickbooks",
        label: "QuickBooks (IIF)",
        description:
            "Intuit Interchange Format journal entries — import via Company > Chart of Accounts > Import from Excel/IIF or the Accountant import tool.",
        fileName: "flashfender-journal.IIF",
    },
    {
        value: "xero",
        label: "Xero (Journal CSV)",
        description:
            "Xero journal lines CSV — import via Accounting > Advanced > Import Journal Entries.",
        fileName: "flashfender-journal-xero.csv",
    },
    {
        value: "sage50",
        label: "Sage 50 (CSV)",
        description:
            "Simple general journal CSV (Date, Reference, Account, Debit, Credit, Memo) — importable into Sage 50's GL journal or by your accountant.",
        fileName: "flashfender-journal-sage50.csv",
    },
] as const;

type FormatValue = (typeof FORMATS)[number]["value"];

export default function AccountingExportPage() {
    const [dealership, setDealership] = useState<DealershipInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [format, setFormat] = useState<FormatValue>("quickbooks");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [exporting, setExporting] = useState(false);
    const [exported, setExported] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const meRes = await fetch("/api/me");
                if (!meRes.ok) throw new Error("Failed to load profile");
                const meJson = await meRes.json();
                const d = meJson?.data?.dealership || meJson?.dealership;
                setDealership(
                    d ? { id: d.id, name: d.name || "Your dealership" } : null
                );
            } catch (err: unknown) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load dealership"
                );
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleDownload = useCallback(async () => {
        setError(null);
        setExported(null);
        setExporting(true);
        try {
            const params = new URLSearchParams({ format });
            if (startDate) params.set("start_date", startDate);
            if (endDate) params.set("end_date", endDate);

            const res = await fetch(`/api/accounting/export?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(
                    body?.error ||
                        `Export failed (${res.status}) — no data may match the selected range`
                );
            }
            const blob = await res.blob();
            const active = FORMATS.find((f) => f.value === format)!;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = active.fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setExported(active.label);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Export failed");
        } finally {
            setExporting(false);
        }
    }, [format, startDate, endDate]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Accounting Export
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Journal export for your accountant — QuickBooks, Xero or
                        Sage 50. Your data, always.
                    </p>
                </div>
            </div>

            <div className="px-6 py-6">
                {dealership && (
                    <p className="mb-4 text-sm text-gray-500">
                        Exporting for{" "}
                        <span className="font-medium text-gray-700">
                            {dealership.name}
                        </span>
                    </p>
                )}

                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-medium">
                        This is a journal export, not a full accounting suite
                    </p>
                    <p className="mt-0.5 text-xs text-amber-900/90">
                        Rows are balanced debits/credits built from your sales,
                        invoices, paid expenses and vehicle purchases. Account
                        names use standard defaults (Accounts Receivable, Sales
                        Revenue, Tax Collected, etc.) — remap them to your chart
                        of accounts after import. We do not post entries
                        anywhere; nothing leaves your dealership until you
                        download the file.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {exported && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                        <p className="text-sm text-green-700">
                            {exported} downloaded — hand it to your accountant.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                                    Format
                                </h2>
                            </div>
                            <div className="space-y-4 p-6">
                                {FORMATS.map((f) => (
                                    <label
                                        key={f.value}
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                                            format === f.value
                                                ? "border-blue-400 bg-blue-50/50"
                                                : "border-gray-200 hover:border-gray-300"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="format"
                                            value={f.value}
                                            checked={format === f.value}
                                            onChange={() => setFormat(f.value)}
                                            className="mt-1 h-4 w-4 text-blue-600"
                                        />
                                        <span>
                                            <span className="block font-medium text-gray-900">
                                                {f.label}
                                            </span>
                                            <span className="mt-0.5 block text-sm text-gray-500">
                                                {f.description}
                                            </span>
                                            <span className="mt-1 block text-xs text-gray-400">
                                                File: {f.fileName}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-4 text-sm font-medium text-gray-500">
                                Date range
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="start-date"
                                        className="mb-1 block text-xs font-medium text-gray-500"
                                    >
                                        From
                                    </label>
                                    <input
                                        id="start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) =>
                                            setStartDate(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="end-date"
                                        className="mb-1 block text-xs font-medium text-gray-500"
                                    >
                                        To
                                    </label>
                                    <input
                                        id="end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) =>
                                            setEndDate(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleDownload()}
                                    disabled={exporting}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {exporting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Building…
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4" />
                                            Download journal
                                        </>
                                    )}
                                </button>
                                <p className="text-xs text-gray-400">
                                    Blank range = everything from 2000 onward.
                                    Sales, invoices, paid expenses and vehicle
                                    purchases are included.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                                <FileText className="h-4 w-4" />
                                What&apos;s included
                            </h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• Sales (closed, non-cancelled deals)</li>
                                <li>• Invoices (all statuses)</li>
                                <li>• Paid expenses incl. tax</li>
                                <li>• Vehicle purchases from the public</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
