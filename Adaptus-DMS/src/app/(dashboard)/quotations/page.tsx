"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Calculator,
    ClipboardCopy,
    Download,
    FileDown,
    FileText,
    Loader2,
    Mail,
    Plus,
    Printer,
    RefreshCw,
    Search,
    Trash2,
    ArrowRightCircle,
    CheckCircle2,
} from "lucide-react";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { EntityLink } from "@/src/components/ui/EntityLink";
import { RelationChip } from "@/src/components/ui/RelationChip";
import { cn } from "@/src/lib/utils";
import { useRouter } from "next/navigation";
import { buildQuotationShareText } from "@/src/lib/quotation-share";
import { computePayment } from "@/src/lib/finance-calc";
import { AiActionButton } from "@/src/components/ai/AiActionButton";
import {
    downloadQuotationPdf,
    fetchQuotationDealerBranding,
    openQuotationPrintWindow,
    type QuotationPdfPayload,
} from "@/src/lib/quotation-pdf";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    retail_price: number;
    status: string;
    stock_number?: string | null;
}

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface Quotation {
    id: string;
    quote_number: string | null;
    customer_id: string | null;
    vehicle_id: string | null;
    status: string;
    sale_price: number;
    down_payment: number;
    trade_in_value: number;
    finance_term: number | null;
    interest_rate: number | null;
    finance_company: string | null;
    tax_rate: number | null;
    admin_fee: number | null;
    monthly_payment: number | null;
    notes: string | null;
    valid_until: string | null;
    converted_deal_id: string | null;
    created_at: string;
    vehicle: Vehicle | null;
    customer: Customer | null;
}

const STATUSES = ["Draft", "Sent", "Accepted", "Expired", "Converted", "Cancelled"] as const;

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount || 0);
}

function quoteVehicleLabel(quote: Quotation): string | null {
    if (!quote.vehicle) return null;
    return `${quote.vehicle.year} ${quote.vehicle.make} ${quote.vehicle.model}`;
}

export default function QuotationsPage() {
    const router = useRouter();
    const [quotes, setQuotes] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const [emailingId, setEmailingId] = useState<string | null>(null);
    const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [coachObjection, setCoachObjection] = useState("price too high");
    const [coachQuoteId, setCoachQuoteId] = useState("");
    const [coachDraft, setCoachDraft] = useState("");
    const [form, setForm] = useState({
        customer_id: "",
        vehicle_id: "",
        status: "Draft",
        sale_price: "",
        down_payment: "0",
        trade_in_value: "0",
        finance_term: "60",
        interest_rate: "5.99",
        tax_rate: "13",
        admin_fee: "899",
        notes: "",
        valid_until: "",
    });

    const monthlyPreview = useMemo(() => {
        return computePayment({
            sale_price: parseFloat(form.sale_price) || 0,
            down_payment: parseFloat(form.down_payment) || 0,
            trade_in_value: parseFloat(form.trade_in_value) || 0,
            interest_rate: parseFloat(form.interest_rate) || 0,
            term_months: parseInt(form.finance_term, 10) || 0,
            tax_rate: parseFloat(form.tax_rate) || 0,
            admin_fee: parseFloat(form.admin_fee) || 0,
            payment_type: "monthly",
        }).payment_amount;
    }, [form]);

    async function fetchQuotes() {
        try {
            setLoading(true);
            let url = "/api/quotations?limit=100";
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
            const data = await apiFetch<{ data: Quotation[] }>(url);
            setQuotes(data?.data || []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load quotations");
        } finally {
            setLoading(false);
        }
    }

    async function fetchLookups() {
        try {
            const [vRes, cRes] = await Promise.all([
                apiFetch<{ data: Vehicle[] }>("/api/vehicles?limit=200&status=Active"),
                apiFetch<{ data: Customer[] }>("/api/customers?limit=200"),
            ]);
            setVehicles(vRes?.data || []);
            setCustomers(cRes?.data || []);
        } catch {
            // lookups optional for list view
        }
    }

    useEffect(() => {
        // Defer to the next tick so the synchronous setState inside fetchQuotes
        // doesn't run while React is still committing the effect.
        const t = setTimeout(() => void fetchQuotes(), 0);
        return () => clearTimeout(t);
    }, [statusFilter, searchTerm]);

    useEffect(() => {
        const t = setTimeout(() => void fetchLookups(), 0);
        return () => clearTimeout(t);
    }, []);

    const handleVehicleSelect = (vehicleId: string) => {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        setForm((prev) => ({
            ...prev,
            vehicle_id: vehicleId,
            sale_price: vehicle ? String(vehicle.retail_price || "") : prev.sale_price,
        }));
    };

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                customer_id: form.customer_id || null,
                vehicle_id: form.vehicle_id || null,
                status: form.status,
                sale_price: parseFloat(form.sale_price) || 0,
                down_payment: parseFloat(form.down_payment) || 0,
                trade_in_value: parseFloat(form.trade_in_value) || 0,
                finance_term: form.finance_term ? parseInt(form.finance_term, 10) : null,
                interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
                tax_rate: form.tax_rate ? parseFloat(form.tax_rate) : 13,
                admin_fee: form.admin_fee ? parseFloat(form.admin_fee) : 0,
                monthly_payment: Math.round(monthlyPreview * 100) / 100,
                notes: form.notes || null,
                valid_until: form.valid_until || null,
            };
            await apiFetch("/api/quotations", { method: "POST", body: payload });
            toast.success("Quotation created");
            setShowForm(false);
            setForm({
                customer_id: "",
                vehicle_id: "",
                status: "Draft",
                sale_price: "",
                down_payment: "0",
                trade_in_value: "0",
                finance_term: "60",
                interest_rate: "5.99",
                tax_rate: "13",
                admin_fee: "899",
                notes: "",
                valid_until: "",
            });
            await fetchQuotes();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create quotation");
        } finally {
            setSaving(false);
        }
    }

    async function handleConvert(quote: Quotation) {
        if (!quote.customer_id || !quote.vehicle_id) {
            toast.error("Link a customer and vehicle before converting");
            return;
        }
        if (
            !confirm(
                `Convert ${quote.quote_number || "this quote"} to a deal? This creates a new sales deal.`
            )
        ) {
            return;
        }
        setConvertingId(quote.id);
        try {
            const result = await apiFetch<{ data: { deal: { id: string } } }>(
                `/api/quotations/${quote.id}/convert`,
                { method: "POST", body: {} }
            );
            toast.success("Converted to deal");
            await fetchQuotes();
            if (result?.data?.deal?.id) {
                router.push(`/deals/${result.data.deal.id}`);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Convert failed");
        } finally {
            setConvertingId(null);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this quotation?")) return;
        try {
            await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
            toast.success("Quotation deleted");
            await fetchQuotes();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
        }
    }

    /** Status-only — does not email. Use Email when Resend is configured. */
    async function handleMarkSent(id: string) {
        try {
            await apiFetch(`/api/quotations/${id}`, {
                method: "PATCH",
                body: { status: "Sent" },
            });
            toast.success("Marked as Sent (status only — no email was sent)");
            await fetchQuotes();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Update failed");
        }
    }

    async function handleCopyQuote(quote: Quotation) {
        const text = buildQuotationShareText({
            quoteNumber: quote.quote_number,
            status: quote.status,
            customerName: quote.customer?.name,
            customerEmail: quote.customer?.email,
            vehicleLabel: quoteVehicleLabel(quote),
            salePrice: quote.sale_price,
            downPayment: quote.down_payment,
            tradeInValue: quote.trade_in_value,
            financeTerm: quote.finance_term,
            interestRate: quote.interest_rate,
            taxRate: quote.tax_rate,
            adminFee: quote.admin_fee,
            monthlyPayment: quote.monthly_payment,
            notes: quote.notes,
            validUntil: quote.valid_until,
        });
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Quote summary copied");
        } catch {
            toast.error("Copy failed");
        }
    }

    async function handleEmailQuote(quote: Quotation) {
        setEmailingId(quote.id);
        try {
            const res = await apiFetch<{
                success?: boolean;
                error?: string;
                to?: string;
                missingConfig?: boolean;
            }>(`/api/quotations/${quote.id}/send`, {
                method: "POST",
                body: { mark_sent: true },
                silent5xx: true,
            });
            if (res.error) throw new Error(res.error);
            toast.success(`Quote emailed to ${res.to || "customer"}`);
            await fetchQuotes();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to email quote";
            toast.error(msg);
        } finally {
            setEmailingId(null);
        }
    }

    const buildQuotePdfPayload = async (
        quote: Quotation
    ): Promise<QuotationPdfPayload> => {
        const dealer = await fetchQuotationDealerBranding();
        const taxRate = quote.tax_rate ?? 13;
        const adminFee = quote.admin_fee ?? 0;
        const calc = computePayment({
            sale_price: quote.sale_price || 0,
            down_payment: quote.down_payment || 0,
            trade_in_value: quote.trade_in_value || 0,
            interest_rate: quote.interest_rate || 0,
            term_months: quote.finance_term || 0,
            tax_rate: taxRate,
            admin_fee: adminFee,
            payment_type: "monthly",
        });
        return {
            quoteNumber: quote.quote_number,
            status: quote.status,
            createdAt: quote.created_at,
            validUntil: quote.valid_until,
            notes: quote.notes,
            customerName: quote.customer?.name,
            customerEmail: quote.customer?.email,
            customerPhone: quote.customer?.phone,
            vehicleLabel: quoteVehicleLabel(quote),
            vin: quote.vehicle?.vin,
            stockNumber: quote.vehicle?.stock_number,
            salePrice: quote.sale_price || 0,
            downPayment: quote.down_payment,
            tradeInValue: quote.trade_in_value,
            taxRate,
            taxAmount: calc.tax_amount,
            adminFee,
            financedAmount: calc.financed_amount,
            financeTerm: quote.finance_term,
            interestRate: quote.interest_rate,
            monthlyPayment: quote.monthly_payment ?? calc.payment_amount,
            financeCompany: quote.finance_company,
            dealer,
        };
    };

    async function handleDownloadPdf(quote: Quotation) {
        setPdfBusyId(quote.id);
        try {
            const payload = await buildQuotePdfPayload(quote);
            await downloadQuotationPdf(payload);
            toast.success("PDF downloaded");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "PDF download failed");
        } finally {
            setPdfBusyId(null);
        }
    }

    async function handlePrintQuote(quote: Quotation) {
        setPdfBusyId(quote.id);
        try {
            const payload = await buildQuotePdfPayload(quote);
            openQuotationPrintWindow(payload);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not open print window");
        } finally {
            setPdfBusyId(null);
        }
    }

    async function exportToExcel() {
        setExportLoading(true);
        try {
            let url = "/api/quotations?limit=10000";
            if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;

            const data = await apiFetch<{ data: Quotation[] }>(url);
            const exportData = data?.data || [];

            if (exportData.length === 0) {
                throw new Error("No quotations found to export");
            }

            const worksheetData = exportData.map((quote) => ({
                "Quote Number": quote.quote_number || "",
                Customer: quote.customer?.name || (quote.customer_id ? "Unlinked" : "Unlinked"),
                "Customer Email": quote.customer?.email || "",
                Vehicle: quoteVehicleLabel(quote) || "",
                VIN: quote.vehicle?.vin || "",
                Status: quote.status || "",
                "Sale Price": quote.sale_price || 0,
                "Down Payment": quote.down_payment || 0,
                "Trade-in": quote.trade_in_value || 0,
                "Tax Rate": quote.tax_rate ?? "",
                "Admin Fee": quote.admin_fee ?? "",
                "Finance Term": quote.finance_term ?? "",
                "Interest Rate": quote.interest_rate ?? "",
                "Monthly Payment": quote.monthly_payment ?? "",
                "Finance Company": quote.finance_company || "",
                "Valid Until": quote.valid_until
                    ? new Date(quote.valid_until).toLocaleDateString()
                    : "",
                "Converted Deal": quote.converted_deal_id || "",
                Created: quote.created_at
                    ? new Date(quote.created_at).toLocaleDateString()
                    : "",
                Notes: quote.notes || "",
            }));

            await downloadXlsx(
                worksheetData,
                "Quotations",
                `quotations-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 16 },
                    { wch: 22 },
                    { wch: 24 },
                    { wch: 28 },
                    { wch: 18 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 10 },
                    { wch: 10 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 14 },
                    { wch: 18 },
                    { wch: 12 },
                    { wch: 36 },
                    { wch: 12 },
                    { wch: 30 },
                ]
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to export quotations");
        } finally {
            setExportLoading(false);
        }
    }

    return (
        <div className="space-y-3 px-3 py-4 sm:px-5 pb-8">
            <PageHeader
                title="Quotations"
                description="Build quotes, then convert to deals"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void exportToExcel()}
                            disabled={exportLoading || loading}
                        >
                            {exportLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Export
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void fetchQuotes()} disabled={loading}>
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                            <Plus className="h-4 w-4" />
                            New Quote
                        </Button>
                    </div>
                }
            />

            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200/90">
                Email requires Resend (Settings → Integrations). Without it, Email returns 503 — no fake send.
                Mark as Sent only updates status after you delivered the quote yourself.
            </p>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Quote objection coach</p>
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm space-y-1">
                        <span className="text-muted-foreground">Quote (optional)</span>
                        <select
                            className="w-full rounded-lg border border-border bg-background px-3 py-2"
                            value={coachQuoteId}
                            onChange={(e) => setCoachQuoteId(e.target.value)}
                        >
                            <option value="">General coaching</option>
                            {quotes.map((q) => (
                                <option key={q.id} value={q.id}>
                                    {q.quote_number || q.id.slice(0, 8)} · {q.status}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm space-y-1">
                        <span className="text-muted-foreground">Objection</span>
                        <input
                            className="w-full rounded-lg border border-border bg-background px-3 py-2"
                            value={coachObjection}
                            onChange={(e) => setCoachObjection(e.target.value)}
                            placeholder="price too high"
                        />
                    </label>
                </div>
                <AiActionButton
                    label="Coach with Flash AI"
                    endpoint="/api/ai/quote-coach"
                    body={{
                        quotation_id: coachQuoteId || undefined,
                        objection: coachObjection,
                    }}
                    onResult={(content) => setCoachDraft(content)}
                />
                {coachDraft ? (
                    <textarea
                        readOnly
                        rows={6}
                        value={coachDraft}
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                    />
                ) : null}
            </div>

            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="rounded-xl border border-border bg-card p-4 space-y-4"
                >
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        New quotation
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Customer</span>
                            <select
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.customer_id}
                                onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
                            >
                                <option value="">Select customer</option>
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Vehicle</span>
                            <select
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.vehicle_id}
                                onChange={(e) => handleVehicleSelect(e.target.value)}
                            >
                                <option value="">Select vehicle</option>
                                {vehicles.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.year} {v.make} {v.model} — {formatCurrency(v.retail_price)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Sale price *</span>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.sale_price}
                                onChange={(e) => setForm((p) => ({ ...p, sale_price: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Down payment</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.down_payment}
                                onChange={(e) => setForm((p) => ({ ...p, down_payment: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Trade-in</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.trade_in_value}
                                onChange={(e) => setForm((p) => ({ ...p, trade_in_value: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Term (months)</span>
                            <input
                                type="number"
                                min="1"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.finance_term}
                                onChange={(e) => setForm((p) => ({ ...p, finance_term: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Rate %</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.interest_rate}
                                onChange={(e) => setForm((p) => ({ ...p, interest_rate: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-muted-foreground">Valid until</span>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                value={form.valid_until}
                                onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))}
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-50 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-primary">
                            <Calculator className="h-4 w-4" />
                            Est. monthly
                        </div>
                        <div className="text-lg font-bold text-primary">{formatCurrency(monthlyPreview)}</div>
                    </div>
                    <label className="block text-sm space-y-1">
                        <span className="text-muted-foreground">Notes</span>
                        <textarea
                            className="w-full rounded-lg border border-border bg-background px-3 py-2"
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                        />
                    </label>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Save quote
                        </Button>
                    </div>
                </form>
            )}

            <div className="sticky top-0 z-10 rounded-xl border border-border bg-card/95 px-3 py-3 backdrop-blur-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search quote # or notes…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        aria-label="Filter quotations by status"
                    >
                        <option value="">All status</option>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-border bg-muted/80">
                            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                <th className="px-3 py-2.5">Quote</th>
                                <th className="px-3 py-2.5">Customer</th>
                                <th className="px-3 py-2.5">Vehicle</th>
                                <th className="px-3 py-2.5">Status</th>
                                <th className="px-3 py-2.5 text-right">Price</th>
                                <th className="px-3 py-2.5 text-right">Payment</th>
                                <th className="px-3 py-2.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    </td>
                                </tr>
                            ) : quotes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                        No quotations yet
                                    </td>
                                </tr>
                            ) : (
                                quotes.map((quote) => (
                                    <tr
                                        key={quote.id}
                                        className="border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/50"
                                    >
                                        <td className="px-3 py-2.5">
                                            {quote.converted_deal_id ? (
                                                <EntityLink href={`/deals/${quote.converted_deal_id}`}>
                                                    {quote.quote_number || quote.id.slice(0, 8)}
                                                </EntityLink>
                                            ) : (
                                                <span className="font-medium text-foreground">
                                                    {quote.quote_number || quote.id.slice(0, 8)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <RelationChip
                                                customerId={quote.customer_id || quote.customer?.id}
                                                name={quote.customer?.name}
                                                emptyLabel="Unlinked"
                                            />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {quote.vehicle
                                                ? `${quote.vehicle.year} ${quote.vehicle.make} ${quote.vehicle.model}`
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                                                {quote.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {formatCurrency(quote.sale_price)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                            {quote.monthly_payment != null
                                                ? formatCurrency(quote.monthly_payment)
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    type="button"
                                                    title="Download PDF"
                                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    disabled={pdfBusyId === quote.id}
                                                    onClick={() => void handleDownloadPdf(quote)}
                                                >
                                                    {pdfBusyId === quote.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <FileDown className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Print quotation"
                                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    disabled={pdfBusyId === quote.id}
                                                    onClick={() => void handlePrintQuote(quote)}
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Copy quote summary"
                                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    onClick={() => void handleCopyQuote(quote)}
                                                >
                                                    <ClipboardCopy className="h-4 w-4" />
                                                </button>
                                                {quote.status !== "Converted" &&
                                                    quote.status !== "Cancelled" && (
                                                    <button
                                                        type="button"
                                                        title="Email quote to customer (Resend)"
                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        disabled={emailingId === quote.id}
                                                        onClick={() => void handleEmailQuote(quote)}
                                                    >
                                                        {emailingId === quote.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Mail className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                                {quote.status === "Draft" && (
                                                    <button
                                                        type="button"
                                                        title="Mark as Sent (status only — does not email)"
                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        onClick={() => void handleMarkSent(quote.id)}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {quote.status !== "Converted" && quote.status !== "Cancelled" && (
                                                    <button
                                                        type="button"
                                                        title="Convert to deal"
                                                        className="rounded-md p-1.5 text-primary hover:bg-primary-50"
                                                        disabled={convertingId === quote.id}
                                                        onClick={() => void handleConvert(quote)}
                                                    >
                                                        {convertingId === quote.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ArrowRightCircle className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                                {quote.status !== "Converted" && (
                                                    <button
                                                        type="button"
                                                        title="Delete"
                                                        className="rounded-md p-1.5 text-destructive hover:bg-destructive-50"
                                                        onClick={() => void handleDelete(quote.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
