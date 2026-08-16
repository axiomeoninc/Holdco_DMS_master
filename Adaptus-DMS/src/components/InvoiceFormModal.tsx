"use client";

import { useState, useEffect } from "react";
import {
    X,
    Save,
    Loader2,
    AlertCircle,
    FileText,
    DollarSign,
    Calendar,
    User,
    Percent,
    Clock,
    Plus,
    Trash2,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";
import {
    parseInvoiceLineItems,
    type InvoiceLineItem,
} from "@/src/lib/invoice-pdf";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
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
    status: string;
    notes: string | null;
    line_items?: unknown;
    created_at: string;
    customer: Customer | null;
}

interface InvoiceFormModalProps {
    mode: "add" | "edit";
    invoice?: Invoice | null;
    onClose: () => void;
    onSuccess: () => void;
}

type LineDraft = {
    description: string;
    qty: number;
    unitPrice: number;
};

function emptyLine(): LineDraft {
    return { description: "", qty: 1, unitPrice: 0 };
}

function toDrafts(
    invoice: Invoice | null | undefined,
    mode: "add" | "edit"
): LineDraft[] {
    if (mode === "edit" && invoice) {
        const parsed = parseInvoiceLineItems(invoice.line_items);
        if (parsed.length > 0) {
            return parsed.map((li) => ({
                description: li.description,
                qty: li.qty,
                unitPrice: li.unitPrice,
            }));
        }
        if (invoice.package_name || invoice.payment_amount) {
            return [
                {
                    description: invoice.package_name || "Services / package",
                    qty: 1,
                    unitPrice: Number(invoice.payment_amount) || 0,
                },
            ];
        }
    }
    return [emptyLine()];
}

export default function InvoiceFormModal({
    mode,
    invoice,
    onClose,
    onSuccess,
}: InvoiceFormModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [lineItems, setLineItems] = useState<LineDraft[]>(() =>
        toDrafts(invoice, mode)
    );
    const [formData, setFormData] = useState({
        invoice_number: "",
        customer_id: "",
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        package_name: "",
        tax_rate: 13,
        notes: "",
        status: "Pending",
    });

    useEffect(() => {
        // Defer form/line-item initialization one tick so the synchronous
        // setState calls don't run while React is committing the effect.
        const t = setTimeout(() => {
            void fetchCustomers();

            if (mode === "edit" && invoice) {
                setFormData({
                    invoice_number: invoice.invoice_number || "",
                    customer_id: invoice.customer_id || "",
                    invoice_date:
                        invoice.invoice_date ||
                        new Date().toISOString().split("T")[0],
                    due_date:
                        invoice.due_date || new Date().toISOString().split("T")[0],
                    package_name: invoice.package_name || "",
                    tax_rate: invoice.tax_rate || 13,
                    notes: invoice.notes || "",
                    status: invoice.status || "Pending",
                });
                setLineItems(toDrafts(invoice, mode));
            } else {
                generateInvoiceNumber();
                setLineItems([emptyLine()]);
            }
        }, 0);
        return () => clearTimeout(t);
    }, [mode, invoice]);

    const generateInvoiceNumber = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const random = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, "0");
        setFormData((prev) => ({
            ...prev,
            invoice_number: `INV-${year}${month}-${random}`,
        }));
    };

    async function fetchCustomers() {
        setLoadingCustomers(true);
        try {
            const data = await apiFetch<{ data?: Customer[] }>(
                "/api/customers?limit=100"
            );
            setCustomers(data.data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
        } finally {
            setLoadingCustomers(false);
        }
    }

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                type === "number"
                    ? value === ""
                        ? ""
                        : parseFloat(value) || 0
                    : value,
        }));
    };

    const updateLine = (
        index: number,
        patch: Partial<LineDraft>
    ) => {
        setLineItems((prev) =>
            prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
        );
    };

    const addLine = () => {
        setLineItems((prev) => [...prev, emptyLine()]);
    };

    const removeLine = (index: number) => {
        setLineItems((prev) =>
            prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
        );
    };

    const normalizedLines: InvoiceLineItem[] = lineItems
        .map((row) => {
            const qty = Number(row.qty) || 0;
            const unitPrice = Number(row.unitPrice) || 0;
            const description = row.description.trim();
            return {
                description,
                qty,
                unitPrice,
                amount: Math.round(qty * unitPrice * 100) / 100,
            };
        })
        .filter((li) => li.description || li.amount > 0);

    const subtotal =
        Math.round(
            normalizedLines.reduce((sum, li) => sum + li.amount, 0) * 100
        ) / 100;

    const calculateTotals = () => {
        const tax =
            Math.round(((subtotal * (Number(formData.tax_rate) || 0)) / 100) * 100) /
            100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        return { tax, total };
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (normalizedLines.length === 0) {
                throw new Error("Add at least one line item");
            }

            const url =
                mode === "add" ? "/api/invoices" : `/api/invoices/${invoice?.id}`;
            const method = mode === "add" ? "POST" : "PATCH";

            const { tax, total } = calculateTotals();
            const packageName =
                formData.package_name.trim() ||
                normalizedLines[0]?.description ||
                null;

            const payload = {
                invoice_number: formData.invoice_number,
                customer_id: formData.customer_id,
                invoice_date: formData.invoice_date,
                due_date: formData.due_date,
                package_name: packageName,
                payment_amount: subtotal,
                tax_rate: formData.tax_rate,
                tax_amount: tax,
                total: total,
                status: formData.status,
                notes: formData.notes || null,
                line_items: normalizedLines,
            };

            await apiFetch(url, {
                method,
                body: payload,
            });

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const { tax, total } = calculateTotals();

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {mode === "add"
                                        ? "Create Invoice"
                                        : "Edit Invoice"}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {mode === "add"
                                        ? "Create a new invoice"
                                        : "Update invoice details"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">
                                        {error}
                                    </p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Invoice Number *
                                    </label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            name="invoice_number"
                                            value={formData.invoice_number}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="INV-20240101-0001"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Status *
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            required
                                        >
                                            <option value="Pending">
                                                Pending
                                            </option>
                                            <option value="Paid">Paid</option>
                                            <option value="Overdue">
                                                Overdue
                                            </option>
                                            <option value="Cancelled">
                                                Cancelled
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Customer *
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                        name="customer_id"
                                        value={formData.customer_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                        required
                                        disabled={loadingCustomers}
                                    >
                                        <option value="">
                                            Select a customer
                                        </option>
                                        {customers.map((customer) => (
                                            <option
                                                key={customer.id}
                                                value={customer.id}
                                            >
                                                {customer.name}{" "}
                                                {customer.email
                                                    ? `(${customer.email})`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Invoice Date
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="date"
                                            name="invoice_date"
                                            value={formData.invoice_date}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Due Date
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="date"
                                            name="due_date"
                                            value={formData.due_date}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Package / Summary label
                                </label>
                                <input
                                    type="text"
                                    name="package_name"
                                    value={formData.package_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Optional — defaults to first line description"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Line items *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addLine}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add line
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {lineItems.map((row, index) => (
                                        <div
                                            key={index}
                                            className="grid grid-cols-12 gap-2 items-end"
                                        >
                                            <div className="col-span-6">
                                                {index === 0 ? (
                                                    <span className="block text-[11px] text-gray-500 mb-1">
                                                        Description
                                                    </span>
                                                ) : null}
                                                <input
                                                    type="text"
                                                    value={row.description}
                                                    onChange={(e) =>
                                                        updateLine(index, {
                                                            description:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Service or product"
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                {index === 0 ? (
                                                    <span className="block text-[11px] text-gray-500 mb-1">
                                                        Qty
                                                    </span>
                                                ) : null}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={row.qty || ""}
                                                    onChange={(e) =>
                                                        updateLine(index, {
                                                            qty:
                                                                parseFloat(
                                                                    e.target
                                                                        .value
                                                                ) || 0,
                                                        })
                                                    }
                                                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                {index === 0 ? (
                                                    <span className="block text-[11px] text-gray-500 mb-1">
                                                        Unit price
                                                    </span>
                                                ) : null}
                                                <div className="relative">
                                                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={
                                                            row.unitPrice || ""
                                                        }
                                                        onChange={(e) =>
                                                            updateLine(index, {
                                                                unitPrice:
                                                                    parseFloat(
                                                                        e.target
                                                                            .value
                                                                    ) || 0,
                                                            })
                                                        }
                                                        className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-1 flex justify-end pb-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeLine(index)
                                                    }
                                                    disabled={
                                                        lineItems.length <= 1
                                                    }
                                                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30"
                                                    title="Remove line"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 text-right">
                                    Line total{" "}
                                    <span className="font-medium text-gray-700">
                                        ${subtotal.toFixed(2)}
                                    </span>
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Subtotal
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={subtotal.toFixed(2)}
                                            readOnly
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Tax Rate (%)
                                    </label>
                                    <div className="relative">
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            name="tax_rate"
                                            value={formData.tax_rate}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Tax Amount
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={tax.toFixed(2)}
                                            readOnly
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-orange-700">
                                        Total Amount
                                    </span>
                                    <span className="text-2xl font-bold text-orange-900">
                                        ${total.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Notes / payment instructions
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    placeholder="Additional notes or payment instructions..."
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {mode === "add"
                                                ? "Creating..."
                                                : "Saving..."}
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            {mode === "add"
                                                ? "Create Invoice"
                                                : "Save Changes"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
