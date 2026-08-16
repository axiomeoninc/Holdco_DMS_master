"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditCard, Loader2, Scan, UserRound, Save, AlertCircle } from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import {
    parseCreditDocOcr,
    mergePrefill,
    type CreditDocType,
    type CreditOcrFields,
} from "@/src/lib/credit/ocr-credit";
import { computeScreeningSummary, type ScreeningSummary } from "@/src/lib/credit/credit-app";

const fieldClass =
    "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

type FormState = Record<string, string>;

const FIELDS: Array<{
    key: string;
    label: string;
    type?: string;
    colSpan?: boolean;
}> = [
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone" },
    { key: "date_of_birth", label: "Date of birth", type: "date" },
    { key: "address", label: "Address", colSpan: true },
    { key: "city", label: "City" },
    { key: "province", label: "Province" },
    { key: "postal_code", label: "Postal code" },
    { key: "employer", label: "Employer" },
    { key: "employment_years", label: "Employment years", type: "number" },
    { key: "annual_income", label: "Annual income (CAD)", type: "number" },
    { key: "monthly_rent", label: "Monthly rent (CAD)", type: "number" },
    { key: "requested_amount", label: "Requested amount (CAD)", type: "number" },
    { key: "trade_in_value", label: "Trade-in value (CAD)", type: "number" },
    { key: "trade_in_payoff", label: "Trade-in payoff (CAD)", type: "number" },
];

function CreditFormInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const customerId = searchParams.get("customer_id") || "";
    const leadId = searchParams.get("lead_id") || "";
    const vehicleId = searchParams.get("vehicle_id") || "";

    const [form, setForm] = useState<FormState>({});
    const [customerLabel, setCustomerLabel] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [summary, setSummary] = useState<ScreeningSummary | null>(null);
    const [scanning, setScanning] = useState(false);
    const [docType, setDocType] = useState<CreditDocType>("drivers_license");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setField = (key: string, value: string) =>
        setForm((f) => ({ ...f, [key]: value }));

    // CRM prefill: resolve customer name + carry over known data for display.
    useEffect(() => {
        if (!customerId) return;
        let cancelled = false;
        void (async () => {
            try {
                const res = await apiFetch<{ data: { name: string; email?: string | null; phone?: string | null } }>(
                    `/api/customers/${customerId}`,
                    { silent: true }
                );
                if (cancelled) return;
                setCustomerLabel(res.data?.name || null);
                setForm((f) => ({
                    ...f,
                    email: f.email || res.data?.email || "",
                    phone: f.phone || res.data?.phone || "",
                }));
            } catch {
                /* leave blank — POST route still prefills server-side */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    useEffect(() => {
        const summary = computeScreeningSummary(form);
        setSummary(summary);
    }, [form]);

    async function handleScanFile(file: File) {
        setScanning(true);
        try {
            const Tesseract = (await import("tesseract.js")).default;
            const result = await Tesseract.recognize(file, "eng");
            const parsed: CreditOcrFields = parseCreditDocOcr(result.data.text, docType);
            const merged = mergePrefill(form, parsed);
            setForm(merged as FormState);
            toast.success(
                `OCR extracted fields${parsed.confidence ? ` (conf ${Math.round(parsed.confidence)}%)` : ""} — review before saving.`
            );
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "OCR failed");
        } finally {
            setScanning(false);
        }
    }

    async function handleSubmit() {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                ...form,
                customer_id: customerId || null,
                lead_id: leadId || null,
                desired_vehicle_id: vehicleId || null,
            };
            const res = await apiFetch<{
                data: { id: string };
                partner_note?: string;
            }>("/api/crm/credit-applications", { method: "POST", body: payload });
            toast.success("Application saved", res.partner_note || "");
            router.push(`/finance/credit/${res.data.id}`);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to save application"
            );
        } finally {
            setSaving(false);
        }
    }

    const readyCount = useMemo(
        () => summary?.missing_fields.length ?? 0,
        [summary]
    );

    return (
        <ListPageShell
            title="New Credit Application"
            description="Capture + prefill (OCR or CRM). Partner-led screening only — FlashFender is not a lender network."
            icon={CreditCard}
            breadcrumbs={[
                { label: "Finance", href: "/finance" },
                { label: "Credit", href: "/finance/credit" },
                { label: "New" },
            ]}
            actions={
                <Button size="sm" onClick={() => void handleSubmit()} disabled={saving}>
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save application
                </Button>
            }
        >
            <div className="max-w-3xl space-y-5">
                {customerId && (
                    <div className="rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-2 text-sm text-[#2563EB]">
                        <UserRound className="mr-1.5 inline h-4 w-4" />
                        Known customer: {customerLabel || "linked"} — missing
                        fields will prefill from the CRM record.
                    </div>
                )}

                {!customerId && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5" />
                        Tip: open this page from a customer or deal with
                        ?customer_id=&lead_id=&vehicle_id= to prefill CRM data.
                    </div>
                )}

                {/* OCR prefill */}
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                            OCR prefill
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleScanFile(file);
                            }}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={scanning}
                            leftIcon={
                                scanning ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Scan className="h-3.5 w-3.5" />
                                )
                            }
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {scanning ? "Scanning…" : "Scan document"}
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                ["drivers_license", "Driver's licence"],
                                ["government_id", "Government ID"],
                                ["paystub", "Paystub"],
                                ["income_doc", "Income doc"],
                            ] as Array<[CreditDocType, string]>
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setDocType(value)}
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                    docType === value
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        Scanned fields fill blank inputs only — your edits are
                        never overwritten. Review everything before saving.
                    </p>
                </div>

                {/* Form */}
                <div className="rounded-lg border border-border bg-card p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {FIELDS.map((f) => (
                            <label
                                key={f.key}
                                className={`block space-y-1.5 ${f.colSpan ? "sm:col-span-2" : ""}`}
                            >
                                <span className="text-xs font-medium text-muted-foreground">
                                    {f.label}
                                </span>
                                <input
                                    type={f.type || "text"}
                                    className={fieldClass}
                                    value={form[f.key] || ""}
                                    onChange={(e) => setField(f.key, e.target.value)}
                                />
                            </label>
                        ))}
                        <label className="block space-y-1.5 sm:col-span-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                Notes
                            </span>
                            <textarea
                                rows={3}
                                className={fieldClass}
                                value={form.notes || ""}
                                onChange={(e) => setField("notes", e.target.value)}
                            />
                        </label>
                    </div>
                </div>

                {/* Live screening summary */}
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">
                        Screening-ready summary
                    </p>
                    {summary && (
                        <div className="space-y-2 text-xs">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                                <span>
                                    Income:{" "}
                                    <b className="text-foreground">
                                        {summary.annual_income
                                            ? `$${summary.annual_income.toLocaleString()}`
                                            : "—"}
                                    </b>
                                </span>
                                <span>
                                    Affordability band:{" "}
                                    <b className="text-foreground">
                                        {summary.affordability_band || "—"}
                                    </b>
                                </span>
                                <span>
                                    Trade equity:{" "}
                                    <b className="text-foreground">
                                        {summary.trade_equity !== null
                                            ? `$${summary.trade_equity.toLocaleString()}`
                                            : "—"}
                                    </b>
                                </span>
                            </div>
                            {summary.missing_fields.length > 0 && (
                                <p className="flex items-center gap-1.5 text-amber-700">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Missing for screening:{" "}
                                    {summary.missing_fields.join(", ")}
                                </p>
                            )}
                            {summary.risk_flags.length > 0 && (
                                <ul className="space-y-1 text-amber-700">
                                    {summary.risk_flags.map((r) => (
                                        <li key={r}>• {r}</li>
                                    ))}
                                </ul>
                            )}
                            {readyCount === 0 && (
                                <p className="text-emerald-700">
                                    Screening-ready. Submit to a configured partner
                                    from the detail page.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    FlashFender is not a lender. Applications are stored locally
                    and only marked &quot;submitted to partner&quot; when a partner channel
                    is configured for this dealership.
                </p>
                <Link
                    href="/finance/credit"
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    ← Back to applications
                </Link>
            </div>
        </ListPageShell>
    );
}

export default function NewCreditApplicationPage() {
    return (
        <Suspense
            fallback={
                <div className="flex justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <CreditFormInner />
        </Suspense>
    );
}
