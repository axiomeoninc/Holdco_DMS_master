"use client";

import { useState, useEffect } from "react";
import {
    X,
    Save,
    DollarSign,
    Calendar,
    FileText,
    Receipt,
    Link as LinkIcon,
    FileText as InvoiceIcon,
    Users,
} from "lucide-react";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { Button } from "@/src/components/ui/Button";

interface Vendor {
    id: string;
    vendor_name: string;
    vendor_type?: string;
    address?: string;
    phone?: string;
    gst_number?: string;
    hst_number?: string;
    pst_number?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
}

interface Vehicle {
    id: string;
    make: string;
    model: string;
    year: number;
    vin: string;
}

interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
}

interface Deal {
    id: string;
    deal_status: string;
    vehicle?: Vehicle;
    customer?: Customer;
}

interface Invoice {
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    customer?: Customer;
}

interface Expense {
    id?: string;
    description: string | null;
    amount: number;
    category: string;
    vendor_id: string | null;
    vehicle_id: string | null;
    expense_date: string;
    due_date: string | null;
    status: string;
    reference_number: string | null;
    notes: string | null;
    tax_amount: number;
    payment_method: string | null;
    source_type?: string | null;
    source_id?: string | null;
}

interface ExpenseLink {
    link_type: string;
    linked_id: string;
    linked_label?: string;
}

const SOURCE_TYPES = [
    { value: "customer", label: "Customer", icon: Users },
    { value: "deal", label: "Deal", icon: FileText },
    { value: "invoice", label: "Invoice", icon: InvoiceIcon },
];

interface ExpenseFormModalProps {
    mode: "add" | "edit";
    expense?: Expense | null;
    onClose: () => void;
    onSuccess: () => void;
}

const EXPENSE_CATEGORIES = [
    "Vehicle Acquisition",
    "Repair & Maintenance",
    "Parts & Supplies",
    "Utilities",
    "Rent & Lease",
    "Insurance",
    "Marketing",
    "Office Supplies",
    "Professional Services",
    "Travel & Entertainment",
    "Payroll",
    "Taxes & Licenses",
    "Interest & Finance",
    "Miscellaneous",
];

const PAYMENT_METHODS = ["Cash", "Check", "Credit Card", "Debit Card", "Bank Transfer", "Wire Transfer"];

export default function ExpenseFormModal({
    mode,
    expense,
    onClose,
    onSuccess
}: ExpenseFormModalProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Related To state
    const [links, setLinks] = useState<ExpenseLink[]>([]);
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [newLinkType, setNewLinkType] = useState("customer");
    const [newLinkId, setNewLinkId] = useState("");

    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "",
        vendor_id: "",
        vehicle_id: "",
        expense_date: new Date().toISOString().split("T")[0],
        due_date: "",
        status: "Pending",
        reference_number: "",
        notes: "",
        tax_amount: "",
        payment_method: ""
    });

    const getLinkLabel = (type: string, id: string): string => {
        switch (type) {
            case "customer": {
                const c = customers.find(x => x.id === id);
                return c ? c.name : id.slice(0, 8);
            }
            case "deal": {
                const d = deals.find(x => x.id === id);
                return d ? `Deal: ${d.vehicle?.make || 'Unknown'}` : id.slice(0, 8);
            }
            case "invoice": {
                const i = invoices.find(x => x.id === id);
                return i ? `Invoice #${i.invoice_number}` : id.slice(0, 8);
            }
            default:
                return id.slice(0, 8);
        }
    };

    async function fetchData() {
        try {
            const [vendorsRes, vehiclesRes, customersRes, dealsRes, invoicesRes] = await Promise.all([
                fetch("/api/vendors?limit=1000", {
                }),
                fetch("/api/vehicles?limit=1000", {
                }),
                fetch("/api/customers?limit=1000", {
                }),
                fetch("/api/deals?limit=1000", {
                }),
                fetch("/api/invoices?limit=1000", {
                }),
            ]);

            const [vendorsData, vehiclesData, customersData, dealsData, invoicesData] = await Promise.all([
                vendorsRes.json(),
                vehiclesRes.json(),
                customersRes.json(),
                dealsRes.json(),
                invoicesRes.json(),
            ]);

            setVendors(vendorsData.data || []);
            setVehicles(vehiclesData.data || []);
            setCustomers(customersData.data || []);
            setDeals(dealsData.data || []);
            setInvoices(invoicesData.data || []);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoadingData(false);
        }
    }

    useEffect(() => {
        void fetchData();
    }, []);

    useEffect(() => {
        if (expense && mode === "edit") {
            setFormData({
                description: expense.description || "",
                amount: expense.amount?.toString() || "",
                category: expense.category || "",
                vendor_id: expense.vendor_id || "",
                vehicle_id: expense.vehicle_id || "",
                expense_date: expense.expense_date?.split("T")[0] || "",
                due_date: expense.due_date?.split("T")[0] || "",
                status: expense.status || "Pending",
                reference_number: expense.reference_number || "",
                notes: expense.notes || "",
                tax_amount: expense.tax_amount?.toString() || "",
                payment_method: expense.payment_method || ""
            });

            // Populate Related To links from expense data
            if (expense.source_type && expense.source_id) {
                const linkLabel = getLinkLabel(expense.source_type, expense.source_id);
                setLinks([{
                    link_type: expense.source_type,
                    linked_id: expense.source_id,
                    linked_label: linkLabel
                }]);
            }
        }
    }, [expense, mode]);

    const addLink = () => {
        if (newLinkType && newLinkId) {
            const label = getLinkLabel(newLinkType, newLinkId);
            setLinks([...links, { link_type: newLinkType, linked_id: newLinkId, linked_label: label }]);
            setNewLinkId("");
            setShowLinkForm(false);
        }
    };

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                throw new Error("Amount must be greater than 0");
            }
            if (!formData.category) {
                throw new Error("Category is required");
            }
            if (!formData.expense_date) {
                throw new Error("Expense date is required");
            }
            const url = expense?.id ? `/api/expenses/${expense.id}` : "/api/expenses";
            const method = expense?.id ? "PATCH" : "POST";

            const payload: Record<string, unknown> = {
                description: formData.description || null,
                amount: parseFloat(formData.amount),
                category: formData.category,
                vendor_id: formData.vendor_id || null,
                vehicle_id: formData.vehicle_id || null,
                expense_date: formData.expense_date,
                due_date: formData.due_date || null,
                status: formData.status,
                reference_number: formData.reference_number || null,
                notes: formData.notes || null,
                tax_amount: parseFloat(formData.tax_amount) || 0,
                payment_method: formData.payment_method || null
            };

            // Add source_type and source_id from first link if exists
            if (links.length > 0) {
                payload.source_type = links[0].link_type;
                payload.source_id = links[0].linked_id;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save expense");
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <ModalShell
            open
            onClose={onClose}
            title={mode === "edit" ? "Edit Expense" : "New Expense"}
            description="Track and manage expenses"
            size="2xl"
            error={error}
            titleIcon={<Receipt className="h-5 w-5" />}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="expense-form-modal"
                        variant="premium"
                        loading={loading}
                        leftIcon={<Save className="h-4 w-4" />}
                    >
                        Save Expense
                    </Button>
                </>
            }
        >
            <form id="expense-form-modal" onSubmit={handleSubmit} className="space-y-6">


                            {/* Amount & Category */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Amount <span className="text-destructive">*</span>
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleChange}
                                            required
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Category <span className="text-destructive">*</span>
                                    </label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        required
                                        disabled={loadingData}
                                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                                    >
                                        <option value="">Select category...</option>
                                        {EXPENSE_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Brief description of the expense..."
                                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Vendor & Vehicle */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Vendor
                                    </label>
                                    <select
                                        name="vendor_id"
                                        value={formData.vendor_id}
                                        onChange={handleChange}
                                        disabled={loadingData}
                                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                                    >
                                        <option value="">Select vendor...</option>
                                        {vendors.map((vendor) => (
                                            <option key={vendor.id} value={vendor.id}>
                                                {vendor.vendor_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Related Vehicle
                                    </label>
                                    <select
                                        name="vehicle_id"
                                        value={formData.vehicle_id}
                                        onChange={handleChange}
                                        disabled={loadingData}
                                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                                    >
                                        <option value="">Select vehicle...</option>
                                        {vehicles.map((vehicle) => (
                                            <option key={vehicle.id} value={vehicle.id}>
                                                {vehicle.year} {vehicle.make} {vehicle.model}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Expense Date <span className="text-destructive">*</span>
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="date"
                                            name="expense_date"
                                            value={formData.expense_date}
                                            onChange={handleChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Due Date
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="date"
                                            name="due_date"
                                            value={formData.due_date}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Status & Payment Method */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Status
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Paid">Paid</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        name="payment_method"
                                        value={formData.payment_method}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                                    >
                                        <option value="">Select method...</option>
                                        {PAYMENT_METHODS.map((method) => (
                                            <option key={method} value={method}>
                                                {method}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tax & Reference */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Tax Amount
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="number"
                                            name="tax_amount"
                                            value={formData.tax_amount}
                                            onChange={handleChange}
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Reference Number
                                    </label>
                                    <input
                                        type="text"
                                        name="reference_number"
                                        value={formData.reference_number}
                                        onChange={handleChange}
                                        placeholder="Invoice #, Receipt #, etc."
                                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>

                            {/* Related To */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Related To</label>
                                {links.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {links.map((link, index) => (
                                            <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-lg flex items-center gap-1">
                                                <LinkIcon className="w-3 h-3" />
                                                {link.link_type}: {link.linked_label || link.linked_id.slice(0, 8)}
                                                <button type="button" onClick={() => removeLink(index)} className="hover:text-purple-900">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {showLinkForm ? (
                                    <div className="flex gap-2">
                                        <select
                                            value={newLinkType}
                                            onChange={(e) => setNewLinkType(e.target.value)}
                                            className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        >
                                            {SOURCE_TYPES.map((t) => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={newLinkId}
                                            onChange={(e) => setNewLinkId(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        >
                                            <option value="">Select...</option>
                                            {newLinkType === "customer" && customers.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ""}</option>
                                            ))}
                                            {newLinkType === "deal" && deals.map((d) => (
                                                <option key={d.id} value={d.id}>Deal - {d.vehicle?.make} {d.vehicle?.model} ({d.deal_status})</option>
                                            ))}
                                            {newLinkType === "invoice" && invoices.map((i) => (
                                                <option key={i.id} value={i.id}>Invoice #{i.invoice_number} - ${i.total} ({i.status})</option>
                                            ))}
                                        </select>
                                        <button type="button" onClick={addLink} disabled={!newLinkId} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Add</button>
                                        <button type="button" onClick={() => { setShowLinkForm(false); setNewLinkId(""); }} className="px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted">Cancel</button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowLinkForm(true)}
                                        className="flex items-center gap-2 px-3 py-2 border border-border border-dashed rounded-lg text-muted-foreground hover:bg-muted w-full justify-center"
                                    >
                                        <LinkIcon className="w-4 h-4" /> Add Link
                                    </button>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Notes
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Additional notes..."
                                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            </div>
            </form>
        </ModalShell>
    );
}
