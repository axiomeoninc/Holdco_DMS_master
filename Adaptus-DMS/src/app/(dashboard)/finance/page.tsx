"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Calculator,
    DollarSign,
    Percent,
    Calendar,
    Loader2,
    RefreshCw,
    Save,
    History,
    AlertCircle,
    Printer,
    Download,
    ClipboardCopy,
    CreditCard,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import {
    computePayment,
    formatCad,
    buildPaymentWorksheetText,
    type PaymentType,
    type FinanceCalcResult,
} from "@/src/lib/finance-calc";

interface FinanceCalculationRow {
    id: string;
    sale_price: number;
    down_payment: number | null;
    trade_in_value: number | null;
    interest_rate: number;
    term_months: number;
    payment_type: PaymentType;
    payment_amount: number;
    total_interest: number | null;
    total_cost: number | null;
    tax_amount: number | null;
    admin_fee: number | null;
    created_at: string;
}

function FinancePageInner() {
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        sale_price: 30000,
        down_payment: 0,
        trade_in_value: 0,
        interest_rate: 5.99,
        term_months: 60,
        tax_rate: 13,
        admin_fee: 899,
        payment_type: "monthly" as PaymentType,
    });
    const [result, setResult] = useState<FinanceCalcResult | null>(null);
    const [history, setHistory] = useState<FinanceCalculationRow[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [saving, setSaving] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [vehicleLabel, setVehicleLabel] = useState<string | undefined>();
    const [customerName, setCustomerName] = useState<string | undefined>();
    const dealId = searchParams.get("deal_id");

    // Prefill from deal / query string
    useEffect(() => {
        const num = (key: string, fallback: number) => {
            const v = searchParams.get(key);
            if (v == null || v === "") return fallback;
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : fallback;
        };
        setFormData((prev) => ({
            ...prev,
            sale_price: num("sale_price", prev.sale_price),
            down_payment: num("down_payment", prev.down_payment),
            trade_in_value: num("trade_in_value", prev.trade_in_value),
            interest_rate: num("interest_rate", prev.interest_rate),
            term_months: Math.round(num("term_months", prev.term_months)) || 60,
            tax_rate: num("tax_rate", prev.tax_rate),
            admin_fee: num("admin_fee", prev.admin_fee),
            payment_type:
                (searchParams.get("payment_type") as PaymentType) ||
                prev.payment_type,
        }));
        const vl = searchParams.get("vehicle");
        const cn = searchParams.get("customer");
        if (vl) setVehicleLabel(vl);
        if (cn) setCustomerName(cn);
    }, [searchParams]);

    useEffect(() => {
        setResult(computePayment(formData));
    }, [formData]);

    const worksheetText = useMemo(() => {
        if (!result) return "";
        return buildPaymentWorksheetText({
            vehicleLabel,
            customerName,
            form: formData,
            result,
        });
    }, [formData, result, vehicleLabel, customerName]);

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        setHistoryError(null);
        try {
            const res = await apiFetch<{ data: FinanceCalculationRow[] }>(
                "/api/finance-calculations?limit=20",
                { silent: true }
            );
            setHistory(res?.data ?? []);
        } catch (err) {
            setHistoryError(
                err instanceof Error
                    ? err.message
                    : "Failed to load saved calculations"
            );
            setHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "payment_type" ? value : parseFloat(value) || 0,
        }));
    };

    async function handleSave() {
        if (!result) return;
        setSaving(true);
        try {
            await apiFetch("/api/finance-calculations", {
                method: "POST",
                body: {
                    sale_price: formData.sale_price,
                    down_payment: formData.down_payment,
                    trade_in_value: formData.trade_in_value,
                    interest_rate: formData.interest_rate,
                    term_months: formData.term_months,
                    payment_type: formData.payment_type,
                    payment_amount: result.payment_amount,
                    total_interest: result.total_interest,
                    total_cost: result.total_cost,
                    tax_amount: result.tax_amount,
                    admin_fee: formData.admin_fee,
                },
            });
            toast.success("Calculation saved");
            await loadHistory();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to save calculation"
            );
        } finally {
            setSaving(false);
        }
    }

    const handlePrint = () => {
        if (!worksheetText) return;
        const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
        if (!w) {
            toast.error("Allow pop-ups to print the worksheet");
            return;
        }
        w.document.write(`<!DOCTYPE html><html><head><title>F&amp;I Worksheet</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;padding:32px;color:#0f172a;line-height:1.5}
  h1{font-size:18px;color:#2563EB;margin:0 0 16px}
  pre{white-space:pre-wrap;font-size:13px}
  @media print{body{padding:12px}}
</style></head><body>
<h1>F&amp;I Payment Worksheet</h1>
<pre>${worksheetText.replace(/</g, "&lt;")}</pre>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
        w.document.close();
    };

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(worksheetText);
            toast.success("Worksheet copied");
        } catch {
            toast.error("Copy failed");
        }
    }

    const handleExportCsv = () => {
        if (!result) return;
        const rows = [
            ["field", "value"],
            ["vehicle", vehicleLabel || ""],
            ["customer", customerName || ""],
            ["deal_id", dealId || ""],
            ["sale_price", String(formData.sale_price)],
            ["tax_rate", String(formData.tax_rate)],
            ["tax_amount", String(result.tax_amount)],
            ["admin_fee", String(formData.admin_fee)],
            ["trade_in", String(formData.trade_in_value)],
            ["down_payment", String(formData.down_payment)],
            ["financed", String(result.financed_amount)],
            ["interest_rate", String(formData.interest_rate)],
            ["term_months", String(formData.term_months)],
            ["payment_type", formData.payment_type],
            ["payment_amount", String(result.payment_amount)],
            ["total_interest", String(result.total_interest)],
            ["total_cost", String(result.total_cost)],
        ];
        const csv = rows
            .map((r) =>
                r
                    .map((c) =>
                        /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c
                    )
                    .join(",")
            )
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fi-worksheet-${dealId || "desk"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported");
    };

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <PageHeader
                title="F&I Desking"
                description="Tax-aware payment worksheet — print, export, or save for deals"
                icon={Calculator}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {dealId && (
                        <Link
                            href={`/deals/${dealId}`}
                            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                        >
                            Back to deal
                        </Link>
                        )}
                        <Link
                            href="/finance/credit/new"
                            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                        >
                            <CreditCard className="mr-1.5 h-4 w-4" />
                            Credit application
                        </Link>
                        <Button
                            variant="outline"
                            onClick={() => void loadHistory()}
                            disabled={loadingHistory}
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${loadingHistory ? "animate-spin" : ""}`}
                            />
                            Refresh
                        </Button>
                    </div>
                }
            />

            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200/90">
                Estimate only — not lender approval, e-contract, or Ontario disclosure paperwork.
                Figures are for desk math; save stores your inputs for this dealership.
            </p>
            {(vehicleLabel || customerName) && (
                <div className="rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-2 text-sm text-[#2563EB]">
                    {vehicleLabel && <span className="font-medium">{vehicleLabel}</span>}
                    {vehicleLabel && customerName && " · "}
                    {customerName && <span>{customerName}</span>}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Deal Inputs
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" />
                                Sale Price
                            </span>
                            <input
                                type="number"
                                name="sale_price"
                                value={formData.sale_price}
                                onChange={handleChange}
                                min={0}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-foreground">
                                Down Payment
                            </span>
                            <input
                                type="number"
                                name="down_payment"
                                value={formData.down_payment}
                                onChange={handleChange}
                                min={0}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-foreground">
                                Trade-In Value
                            </span>
                            <input
                                type="number"
                                name="trade_in_value"
                                value={formData.trade_in_value}
                                onChange={handleChange}
                                min={0}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Percent className="h-3.5 w-3.5" />
                                Interest Rate %
                            </span>
                            <input
                                type="number"
                                name="interest_rate"
                                value={formData.interest_rate}
                                onChange={handleChange}
                                min={0}
                                step={0.01}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                Term (months)
                            </span>
                            <select
                                name="term_months"
                                value={formData.term_months}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            >
                                {[12, 24, 36, 48, 60, 72, 84, 96].map((m) => (
                                    <option key={m} value={m}>
                                        {m} months
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-foreground">
                                Tax Rate %
                            </span>
                            <input
                                type="number"
                                name="tax_rate"
                                value={formData.tax_rate}
                                onChange={handleChange}
                                min={0}
                                step={0.01}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1.5 sm:col-span-2">
                            <span className="text-sm font-medium text-foreground">
                                Admin Fee
                            </span>
                            <input
                                type="number"
                                name="admin_fee"
                                value={formData.admin_fee}
                                onChange={handleChange}
                                min={0}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </label>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium text-foreground">
                            Payment Frequency
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {(["monthly", "biweekly", "weekly"] as PaymentType[]).map(
                                (type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                payment_type: type,
                                            }))
                                        }
                                        className={`rounded-lg border-2 px-3 py-2 text-sm capitalize transition-colors ${
                                            formData.payment_type === type
                                                ? "border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]"
                                                : "border-border hover:border-[#2563EB]/40"
                                        }`}
                                    >
                                        {type === "biweekly" ? "Bi-Weekly" : type}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Worksheet
                    </h3>

                    {result && (
                        <>
                            <div className="rounded-2xl bg-[#2563EB] p-6 text-white">
                                <p className="text-sm opacity-90 mb-1">
                                    Your {formData.payment_type} payment
                                </p>
                                <p className="text-4xl font-bold">
                                    {formatCad(result.payment_amount)}
                                </p>
                                <p className="text-sm opacity-80 mt-1">
                                    {formData.payment_type === "monthly"
                                        ? "/month"
                                        : formData.payment_type === "biweekly"
                                          ? "/bi-week"
                                          : "/week"}
                                </p>
                            </div>

                            <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Financed</span>
                                    <span className="font-medium">
                                        {formatCad(result.financed_amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span className="font-medium">
                                        {formatCad(result.tax_amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Total Interest
                                    </span>
                                    <span className="font-medium text-[#2563EB]">
                                        {formatCad(result.total_interest)}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                                    <span>Total Cost of Financing</span>
                                    <span>{formatCad(result.total_cost)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePrint}
                                >
                                    <Printer className="h-4 w-4" />
                                    Print
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void handleCopy()}
                                >
                                    <ClipboardCopy className="h-4 w-4" />
                                    Copy
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleExportCsv}
                                >
                                    <Download className="h-4 w-4" />
                                    CSV
                                </Button>
                                <Button
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Save
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Saved Calculations
                    </h3>
                </div>

                {loadingHistory ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : historyError ? (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {historyError}
                    </div>
                ) : history.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No saved calculations yet. Run the calculator and save one.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-muted-foreground">
                                    <th className="pb-2 pr-3 font-medium">Date</th>
                                    <th className="pb-2 pr-3 font-medium">Sale</th>
                                    <th className="pb-2 pr-3 font-medium">Rate</th>
                                    <th className="pb-2 pr-3 font-medium">Term</th>
                                    <th className="pb-2 pr-3 font-medium">Payment</th>
                                    <th className="pb-2 font-medium">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="border-b border-border/60 last:border-0"
                                    >
                                        <td className="py-2.5 pr-3 text-muted-foreground">
                                            {new Date(row.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-2.5 pr-3">
                                            {formatCad(row.sale_price)}
                                        </td>
                                        <td className="py-2.5 pr-3">{row.interest_rate}%</td>
                                        <td className="py-2.5 pr-3">{row.term_months} mo</td>
                                        <td className="py-2.5 pr-3 font-medium">
                                            {formatCad(row.payment_amount)}
                                        </td>
                                        <td className="py-2.5 capitalize">
                                            {row.payment_type}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function FinancePage() {
    return (
        <Suspense
            fallback={
                <div className="flex justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <FinancePageInner />
        </Suspense>
    );
}
