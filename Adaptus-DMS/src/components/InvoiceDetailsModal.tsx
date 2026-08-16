"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, FileDown, Mail, Plus, Printer } from "lucide-react";
import { RecordDrawer } from "@/src/components/ui/RecordDrawer";
import { RecordHeader } from "@/src/components/ui/RecordHeader";
import {
    PropertyList,
    PropertyRow,
    PropertyEmpty,
    RecordNotes,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/Button";
import { RelationChip } from "@/src/components/ui/RelationChip";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import {
    downloadInvoicePdf,
    openInvoicePrintWindow,
    parseInvoiceLineItems,
    type InvoiceLineItem,
    type InvoicePdfPayload,
} from "@/src/lib/invoice-pdf";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar?: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
}

interface Invoice {
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    customer_id: string;
    package_name: string | null;
    payment_amount: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    amount_paid?: number | null;
    status: string;
    notes: string | null;
    line_items?: unknown;
    created_at: string;
    customer: Customer | null;
}

interface PaymentRow {
    id: string;
    amount: number;
    description: string | null;
    category: string | null;
    transaction_date: string;
    created_at: string;
}

interface DealerFields {
    dealerName: string | null;
    dealerAddress: string | null;
    dealerPhone: string | null;
    dealerEmail: string | null;
    dealerHst: string | null;
    dealerLicence: string | null;
    dealerLogoUrl: string | null;
}

interface InvoiceDetailsModalProps {
    invoice: Invoice;
    onClose: () => void;
    onEdit: () => void;
    onUpdated?: (invoice: Invoice) => void;
    userRole?: string;
    userPermissions?: string[];
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(amount);
}

async function fetchDealerFields(): Promise<DealerFields> {
    const empty: DealerFields = {
        dealerName: null,
        dealerAddress: null,
        dealerPhone: null,
        dealerEmail: null,
        dealerHst: null,
        dealerLicence: null,
        dealerLogoUrl: null,
    };
    try {
        const meRes = await fetch("/api/me", { credentials: "include" });
        if (!meRes.ok) return empty;
        const meJson = await meRes.json();
        const d = meJson?.data?.dealership || meJson?.dealership;
        if (!d) return empty;
        const settings =
            d.settings && typeof d.settings === "object"
                ? (d.settings as Record<string, unknown>)
                : {};
        return {
            dealerName: d.business_name || d.name || null,
            dealerAddress: d.business_address || null,
            dealerPhone: d.business_phone || null,
            dealerEmail: d.business_email || null,
            dealerLogoUrl: d.logo_url || null,
            dealerLicence:
                (typeof settings.dealer_license === "string"
                    ? settings.dealer_license
                    : null) ||
                (typeof settings.license_number === "string"
                    ? settings.license_number
                    : null) ||
                d.dealer_license ||
                null,
            dealerHst:
                (typeof settings.hst_number === "string"
                    ? settings.hst_number
                    : null) ||
                d.hst_number ||
                null,
        };
    } catch {
        return empty;
    }
}

export default function InvoiceDetailsModal({
    invoice: initialInvoice,
    onClose,
    onEdit,
    onUpdated,
    userRole,
    userPermissions = [],
}: InvoiceDetailsModalProps) {
    const [invoice, setInvoice] = useState(initialInvoice);
    // Keep local invoice state in sync when the parent passes a new one
    // (React 19 "adjust state during render" pattern).
    const [prevInitialInvoice, setPrevInitialInvoice] = useState(initialInvoice);
    if (initialInvoice !== prevInitialInvoice) {
        setPrevInitialInvoice(initialInvoice);
        setInvoice(initialInvoice);
    }
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [busy, setBusy] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("E-Transfer");
    const [payNote, setPayNote] = useState("");
    const [showPayForm, setShowPayForm] = useState(false);
    const [dealer, setDealer] = useState<DealerFields | null>(null);

    const canEdit =
        userRole === "Admin" ||
        userRole === "Manager" ||
        userPermissions.includes("invoices:write") ||
        userPermissions.includes("*");
    const amountPaid = Number(invoice.amount_paid) || 0;
    const balanceDue = Math.max(0, (Number(invoice.total) || 0) - amountPaid);
    const isOverdue =
        invoice.status !== "Paid" &&
        invoice.status !== "Cancelled" &&
        new Date(invoice.due_date) < new Date();

    const lineItems: InvoiceLineItem[] = parseInvoiceLineItems(
        invoice.line_items
    );

    const loadPayments = useCallback(async () => {
        try {
            setLoadingPayments(true);
            const res = await apiFetch<{
                data?: PaymentRow[];
                totals?: { amountPaid?: number };
                error?: string;
            }>(`/api/invoices/${invoice.id}/payments`);
            if (res.error) throw new Error(res.error);
            setPayments(res.data || []);
            if (res.totals?.amountPaid != null) {
                setInvoice((prev) => ({
                    ...prev,
                    amount_paid: res.totals!.amountPaid!,
                }));
            }
        } catch (err) {
            console.error(err);
            setPayments([]);
        } finally {
            setLoadingPayments(false);
        }
    }, [invoice.id]);

    useEffect(() => {
        // Defer so loadPayments' synchronous setState runs after commit.
        const t = setTimeout(() => void loadPayments(), 0);
        return () => clearTimeout(t);
    }, [loadPayments]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const fields = await fetchDealerFields();
            if (!cancelled) setDealer(fields);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const buildPdfPayload = async (): Promise<InvoicePdfPayload> => {
        const dealerFields = dealer ?? (await fetchDealerFields());
        if (!dealer) setDealer(dealerFields);

        const c = invoice.customer;
        const addr = [c?.address, c?.city, c?.province]
            .filter(Boolean)
            .join(", ");
        return {
            invoiceNumber: invoice.invoice_number,
            invoiceDate: invoice.invoice_date,
            dueDate: invoice.due_date,
            status: invoice.status,
            packageName: invoice.package_name,
            notes: invoice.notes,
            paymentInstructions: invoice.notes,
            subtotal: Number(invoice.payment_amount) || 0,
            taxRate: Number(invoice.tax_rate) || 0,
            taxAmount: Number(invoice.tax_amount) || 0,
            total: Number(invoice.total) || 0,
            amountPaid,
            customerName: c?.name,
            customerEmail: c?.email,
            customerPhone: c?.phone,
            customerAddress: addr || null,
            dealerName: dealerFields.dealerName,
            dealerAddress: dealerFields.dealerAddress,
            dealerPhone: dealerFields.dealerPhone,
            dealerEmail: dealerFields.dealerEmail,
            dealerHst: dealerFields.dealerHst,
            dealerLicence: dealerFields.dealerLicence,
            dealerLogoUrl: dealerFields.dealerLogoUrl,
            lineItems,
            payments: payments.map((p) => ({
                date: p.transaction_date,
                amount: Number(p.amount) || 0,
                method: p.category || undefined,
                note: p.description || undefined,
            })),
        };
    };

    async function handleDownloadPdf() {
        try {
            setBusy(true);
            const payload = await buildPdfPayload();
            await downloadInvoicePdf(payload);
            toast.success("PDF downloaded");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not download PDF"
            );
        } finally {
            setBusy(false);
        }
    }

    async function handlePrint() {
        try {
            setBusy(true);
            const payload = await buildPdfPayload();
            openInvoicePrintWindow(payload);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not open print view"
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleEmail() {
        try {
            setBusy(true);
            const res = await apiFetch<{
                success?: boolean;
                error?: string;
                to?: string;
                missingConfig?: boolean;
            }>(`/api/invoices/${invoice.id}/send`, {
                method: "POST",
                body: {},
                // Route already returns a clear 503 body; avoid duplicate "Server error" toast.
                silent5xx: true,
            });
            if (res.error) throw new Error(res.error);
            toast.success(`Invoice emailed to ${res.to || "customer"}`);
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Failed to send invoice";
            toast.error(
                msg.includes("Resend") || msg.includes("not configured")
                    ? "Email not configured"
                    : "Failed to send invoice",
                msg
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleRecordPayment() {
        const amount = parseFloat(payAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error("Enter a positive payment amount");
            return;
        }
        try {
            setBusy(true);
            const res = await apiFetch<{
                invoice?: Invoice;
                totals?: { amountPaid?: number; balanceDue?: number };
                error?: string;
                warning?: string;
            }>(`/api/invoices/${invoice.id}/payments`, {
                method: "POST",
                body: {
                    amount,
                    method: payMethod,
                    note: payNote || undefined,
                },
            });
            if (res.error && !res.invoice) throw new Error(res.error);
            if (res.warning) toast.warning(res.warning);
            if (res.invoice) {
                setInvoice(res.invoice);
                onUpdated?.(res.invoice);
            }
            setPayAmount("");
            setPayNote("");
            setShowPayForm(false);
            toast.success("Payment recorded");
            await loadPayments();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to record payment"
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={invoice.invoice_number}
                    showAvatar={false}
                    subtitle={
                        isOverdue ? (
                            <span className="text-destructive">
                                Overdue · due {formatDate(invoice.due_date)}
                            </span>
                        ) : balanceDue > 0 ? (
                            <span>
                                Balance due {formatCurrency(balanceDue)}
                            </span>
                        ) : undefined
                    }
                    badges={
                        <StatusBadge
                            status={invoice.status}
                            resource="invoice"
                        />
                    }
                />
            }
            actions={
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<FileDown className="h-3.5 w-3.5" />}
                        onClick={() => void handleDownloadPdf()}
                        disabled={busy}
                    >
                        Download PDF
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Printer className="h-3.5 w-3.5" />}
                        onClick={() => void handlePrint()}
                        disabled={busy}
                    >
                        Print
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Mail className="h-3.5 w-3.5" />}
                        title="Email invoice to customer (Resend) — sends via Resend, not just status"
                        onClick={() => void handleEmail()}
                        disabled={busy}
                    >
                        Email
                    </Button>
                    {canEdit ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Edit className="h-3.5 w-3.5" />}
                            onClick={onEdit}
                        >
                            Edit
                        </Button>
                    ) : null}
                </div>
            }
            footer={
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <PropertyList title="Invoice">
                    <PropertyRow label="Customer">
                        <RelationChip
                            customerId={
                                invoice.customer_id || invoice.customer?.id
                            }
                            name={invoice.customer?.name}
                            avatarUrl={invoice.customer?.avatar}
                            emptyLabel="Unlinked"
                            className="justify-end"
                        />
                    </PropertyRow>
                    <PropertyRow label="Invoice date">
                        {formatDate(invoice.invoice_date)}
                    </PropertyRow>
                    <PropertyRow label="Due date">
                        <span
                            className={
                                isOverdue ? "text-destructive" : undefined
                            }
                        >
                            {formatDate(invoice.due_date)}
                        </span>
                    </PropertyRow>
                    <PropertyRow label="Description">
                        {invoice.package_name?.trim() ? (
                            invoice.package_name
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    {lineItems.length > 0 ? (
                        <PropertyRow label="Line items">
                            <ul className="space-y-1 text-right text-sm">
                                {lineItems.map((li, idx) => (
                                    <li key={`${li.description}-${idx}`}>
                                        {li.description}
                                        {li.qty !== 1 ? ` × ${li.qty}` : ""}{" "}
                                        · {formatCurrency(li.amount)}
                                    </li>
                                ))}
                            </ul>
                        </PropertyRow>
                    ) : null}
                    <PropertyRow label="Subtotal">
                        {formatCurrency(invoice.payment_amount)}
                    </PropertyRow>
                    <PropertyRow label={`Tax (${invoice.tax_rate}%)`}>
                        {formatCurrency(invoice.tax_amount)}
                    </PropertyRow>
                    <PropertyRow label="Total">
                        <span className="text-base font-semibold tabular-nums">
                            {formatCurrency(invoice.total)}
                        </span>
                    </PropertyRow>
                    <PropertyRow label="Amount paid">
                        {formatCurrency(amountPaid)}
                    </PropertyRow>
                    <PropertyRow label="Balance due">
                        <span className="font-semibold tabular-nums">
                            {formatCurrency(balanceDue)}
                        </span>
                    </PropertyRow>
                </PropertyList>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                            Payment ledger
                        </h3>
                        {canEdit && invoice.status !== "Cancelled" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Plus className="h-3.5 w-3.5" />}
                                onClick={() => setShowPayForm((v) => !v)}
                            >
                                Record payment
                            </Button>
                        )}
                    </div>

                    {showPayForm && (
                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <label className="text-xs text-muted-foreground col-span-1">
                                    Amount
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={payAmount}
                                        onChange={(e) =>
                                            setPayAmount(e.target.value)
                                        }
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        placeholder={String(balanceDue || "")}
                                    />
                                </label>
                                <label className="text-xs text-muted-foreground col-span-1">
                                    Method
                                    <select
                                        value={payMethod}
                                        onChange={(e) =>
                                            setPayMethod(e.target.value)
                                        }
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    >
                                        <option>E-Transfer</option>
                                        <option>Cash</option>
                                        <option>Cheque</option>
                                        <option>Card</option>
                                        <option>Financing</option>
                                        <option>Other</option>
                                    </select>
                                </label>
                            </div>
                            <label className="block text-xs text-muted-foreground">
                                Note
                                <input
                                    type="text"
                                    value={payNote}
                                    onChange={(e) => setPayNote(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    placeholder="Optional"
                                />
                            </label>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPayForm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void handleRecordPayment()}
                                >
                                    Save payment
                                </Button>
                            </div>
                        </div>
                    )}

                    {loadingPayments ? (
                        <p className="text-sm text-muted-foreground">
                            Loading payments…
                        </p>
                    ) : payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No payments recorded yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border rounded-lg border border-border">
                            {payments.map((p) => (
                                <li
                                    key={p.id}
                                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {formatDate(p.transaction_date)}
                                            {p.category
                                                ? ` · ${p.category}`
                                                : ""}
                                        </p>
                                        {p.description ? (
                                            <p className="text-xs text-muted-foreground">
                                                {p.description}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span className="tabular-nums font-medium">
                                        {formatCurrency(Number(p.amount) || 0)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {invoice.notes?.trim() && (
                    <RecordNotes>{invoice.notes}</RecordNotes>
                )}

                <ActivityTimeline
                    items={[
                        {
                            id: "created",
                            title: "Invoice created",
                            timestamp: formatDate(invoice.created_at),
                        },
                        {
                            id: "due",
                            title: "Due",
                            timestamp: formatDate(invoice.due_date),
                        },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
