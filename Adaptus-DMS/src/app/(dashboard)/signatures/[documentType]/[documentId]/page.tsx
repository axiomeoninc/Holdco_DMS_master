"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
    PenLine,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Download,
    FileSignature,
    ShieldCheck,
} from "lucide-react";

type DocumentType = "bill_of_sale" | "quotation" | "we_owe" | "invoice";

const DOC_LABELS: Record<string, string> = {
    bill_of_sale: "Bill of Sale",
    quotation: "Quotation",
    we_owe: "We Owe",
    invoice: "Invoice",
};

const CONSENT_TEXT =
    "I agree that by typing my name and initials and clicking Agree and Sign, " +
    "this is my electronic signature and I consent to sign this document electronically.";

interface SignatureRecord {
    id: string;
    signer_name: string;
    signer_initials: string;
    signer_role: string;
    consent_timestamp: string;
    consent_text: string;
    created_at: string;
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    } catch {
        return iso;
    }
}

export default function SignDocumentPage() {
    const params = useParams<{ documentType: string; documentId: string }>();
    const documentType = params.documentType as DocumentType;
    const documentId = params.documentId;

    const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
    const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [signerName, setSignerName] = useState("");
    const [signerInitials, setSignerInitials] = useState("");
    const [signerRole, setSignerRole] = useState<"buyer" | "seller" | "manager">("buyer");
    const [consentChecked, setConsentChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<SignatureRecord | null>(null);

    const validDocType = ["bill_of_sale", "quotation", "we_owe", "invoice"].includes(
        documentType
    );

    const docLabel = useMemo(() => DOC_LABELS[documentType] || "Document", [documentType]);

    useEffect(() => {
        if (!validDocType) return;
        void (async () => {
            try {
                const [sigRes, docRes] = await Promise.all([
                    fetch(
                        `/api/esign/signatures?document_type=${documentType}&document_id=${documentId}`
                    ),
                    fetch(`/api/${fetchSummaryEndpoint(documentType)}/${documentId}`),
                ]);
                const sigJson = await sigRes.json().catch(() => ({ data: [] }));
                setSignatures(sigJson.data || []);
                if (docRes.ok) {
                    const docJson = await docRes.json();
                    setSummary(docJson.data || null);
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to load document");
            } finally {
                setLoading(false);
            }
        })();
    }, [documentType, documentId, validDocType]);

    async function handleSubmit() {
        setError(null);
        if (!signerName.trim() || signerName.trim().length < 2) {
            setError("Type the signer's full name.");
            return;
        }
        if (!signerInitials.trim()) {
            setError("Type the signer's initials.");
            return;
        }
        if (!consentChecked) {
            setError("You must check the consent box to sign.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/esign/signatures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_type: documentType,
                    document_id: documentId,
                    signer_name: signerName.trim(),
                    signer_initials: signerInitials.trim(),
                    signer_role: signerRole,
                    consent_text: CONSENT_TEXT,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Failed to record signature");
            }
            setSuccess(json.data as SignatureRecord);
            setSignatures((prev) => [json.data as SignatureRecord, ...prev]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Signing failed");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDownload() {
        setError(null);
        try {
            const res = await fetch(
                `/api/esign/signed-pdf?document_type=${documentType}&document_id=${documentId}`
            );
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error || `Download failed (${res.status})`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${docLabel.replace(/\s+/g, "-")}-${documentId.slice(0, 8)}-signed.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Download failed");
        }
    }

    if (!validDocType) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    Unsupported document type.
                </div>
            </div>
        );
    }

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
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <FileSignature className="h-6 w-6 text-blue-600" />
                        Sign {docLabel}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Electronic signature — typed name, initials and consent.
                        Not a wet signature.
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

                {success && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                        <div className="text-sm text-green-700">
                            <p className="font-medium">
                                Signed by {success.signer_name} at{" "}
                                {fmtDate(success.consent_timestamp)}
                            </p>
                            <p className="text-xs">
                                Signature record ID: {success.id}
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        {/* Document summary */}
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {docLabel} — {documentId.slice(0, 8)}
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                                <SummaryRow label="Customer / Buyer" value={summaryValue(summary, ["buyer_name", "customer_name", "customer"])} />
                                <SummaryRow label="Vehicle" value={summaryValue(summary, ["vehicle_description", "vehicle_label"])} />
                                <SummaryRow label="VIN" value={summaryValue(summary, ["vin"])} />
                                <SummaryRow label="Number" value={summaryValue(summary, ["quote_number", "invoice_number", "document_number"])} />
                            </div>
                        </div>

                        {/* Sign form */}
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                    <PenLine className="h-5 w-5 text-blue-600" />
                                    Sign this document
                                </h2>
                            </div>
                            <div className="space-y-4 p-6">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">
                                            Typed full name
                                        </label>
                                        <input
                                            type="text"
                                            value={signerName}
                                            onChange={(e) => setSignerName(e.target.value)}
                                            placeholder="e.g. Jane Doe"
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">
                                            Initials
                                        </label>
                                        <input
                                            type="text"
                                            value={signerInitials}
                                            onChange={(e) => setSignerInitials(e.target.value)}
                                            placeholder="e.g. JD"
                                            maxLength={8}
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-500">
                                        Signing as
                                    </label>
                                    <select
                                        value={signerRole}
                                        onChange={(e) =>
                                            setSignerRole(
                                                e.target.value as "buyer" | "seller" | "manager"
                                            )
                                        }
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                                    >
                                        <option value="buyer">Buyer / Customer</option>
                                        <option value="seller">Seller / Dealership</option>
                                        <option value="manager">Dealership Manager</option>
                                    </select>
                                </div>

                                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <input
                                        type="checkbox"
                                        checked={consentChecked}
                                        onChange={(e) => setConsentChecked(e.target.checked)}
                                        className="mt-1 h-4 w-4 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        {CONSENT_TEXT}
                                    </span>
                                </label>

                                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                    <ShieldCheck className="h-5 w-5 flex-shrink-0 text-blue-600" />
                                    <p>
                                        The timestamp, name and consent are recorded
                                        server-side and kept in the dealership audit
                                        trail (10-year retention). This is an electronic
                                        signature record, not a wet signature.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void handleSubmit()}
                                    disabled={submitting || signatures.length > 0}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Recording…
                                        </>
                                    ) : signatures.length > 0 ? (
                                        "Already signed"
                                    ) : (
                                        <>
                                            <FileSignature className="h-4 w-4" />
                                            Agree and Sign
                                        </>
                                    )}
                                </button>
                                {signatures.length > 0 && (
                                    <p className="text-xs text-gray-400">
                                        To re-sign with a different role, pick that role
                                        and record again. Duplicate roles are rejected.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-3 text-sm font-medium text-gray-500">
                                Signature records
                            </h3>
                            {signatures.length === 0 ? (
                                <p className="text-sm text-gray-400">
                                    No signatures recorded yet.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {signatures.map((sig) => (
                                        <li
                                            key={sig.id}
                                            className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                                        >
                                            <p className="text-sm font-medium text-gray-900">
                                                {sig.signer_name}{" "}
                                                <span className="text-xs font-normal text-gray-400">
                                                    ({sig.signer_role})
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {fmtDate(sig.consent_timestamp)}
                                            </p>
                                            <p className="mt-1 break-all font-mono text-[10px] text-gray-400">
                                                {sig.id}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-3 text-sm font-medium text-gray-500">
                                Signed PDF
                            </h3>
                            <button
                                type="button"
                                onClick={() => void handleDownload()}
                                disabled={signatures.length === 0}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                            >
                                <Download className="h-4 w-4" />
                                Download signed PDF
                            </button>
                            <p className="mt-2 text-xs text-gray-400">
                                Appends the electronic signature record page to the
                                document PDF.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function fetchSummaryEndpoint(type: DocumentType): string {
    switch (type) {
        case "bill_of_sale":
        case "we_owe":
            return "bill-of-sale";
        case "quotation":
            return "quotations";
        case "invoice":
            return "invoices";
    }
}

function summaryValue(
    summary: Record<string, unknown> | null,
    keys: string[]
): string {
    if (!summary) return "—";
    for (const key of keys) {
        const v = summary[key];
        if (v == null) continue;
        if (typeof v === "object") {
            const o = v as Record<string, unknown>;
            const name = o.name || o.full_name;
            if (name) return String(name);
            continue;
        }
        return String(v);
    }
    return "—";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-400">{label}</p>
            <p className="mt-0.5 text-sm text-gray-800">{value}</p>
        </div>
    );
}
