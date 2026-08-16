"use client";

import { useState, useEffect } from "react";
import {
    Save,
    FileText,
    DollarSign,
    Calendar,
    User,
    Car,
    Percent,
    Clock,
    Building
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { FieldHelp } from "@/src/components/ui/FieldHelp";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { Button } from "@/src/components/ui/Button";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    retail_price: number;
    status: string;
    condition?: string;
    image_gallery?: string[];
}

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
}

interface Salesperson {
    id: string;
    full_name: string;
    email: string;
    avatar?: string | null;
}

interface Deal {
    id: string;
    vehicle_id: string | null;
    customer_id: string | null;
    deal_status: string;
    finance_term: number | null;
    interest_rate: number | null;
    down_payment: number;
    trade_in_value?: number | null;
    sale_price: number;
    salesperson_id: string | null;
    finance_company: string | null;
    notes: string | null;
    deal_date: string;
    created_at: string;
    vehicle: Vehicle | null;
    customer: Customer | null;
    salesperson: Salesperson | null;
}

interface DealFormModalProps {
    mode: "add" | "edit";
    deal?: Deal | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DealFormModal({
    mode,
    deal,
    onClose,
    onSuccess
}: DealFormModalProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
    const [formData, setFormData] = useState({
        vehicle_id: "",
        customer_id: "",
        deal_status: "Negotiation",
        sale_price: 0,
        down_payment: 0,
        trade_in_value: 0,
        finance_term: "",
        interest_rate: "",
        finance_company: "",
        salesperson_id: "",
        notes: "",
        deal_date: new Date().toISOString().split("T")[0]
    });

    async function fetchDropdownData() {
        setLoadingData(true);
        try {
            // Fetch vehicles that are active (not sold)
            const vehiclesData = await apiFetch<{ data: Vehicle[] }>("/api/vehicles?status=Active");
            let list = vehiclesData.data || [];
            // Keep current deal vehicle selectable even if Sold / Closed
            if (deal?.vehicle && !list.some((v) => v.id === deal.vehicle!.id)) {
                list = [deal.vehicle, ...list];
            }
            setVehicles(list);

            // Fetch customers
            const customersData = await apiFetch<{ data: Customer[] }>("/api/customers?limit=100");
            setCustomers(customersData.data || []);

            // Fetch users for salespeople
            const usersData = await apiFetch<{ data: Salesperson[] }>("/api/users?limit=100");
            setSalespersons(usersData.data || []);
        } catch (err) {
            console.error("Error fetching dropdown data:", err);
        } finally {
            setLoadingData(false);
        }
    }

    useEffect(() => {
        void fetchDropdownData();

        if (mode === "edit" && deal) {
            setFormData({
                vehicle_id: deal.vehicle_id || "",
                customer_id: deal.customer_id || "",
                deal_status: deal.deal_status || "Negotiation",
                sale_price: deal.sale_price || 0,
                down_payment: deal.down_payment || 0,
                trade_in_value: deal.trade_in_value || 0,
                finance_term: deal.finance_term?.toString() || "",
                interest_rate: deal.interest_rate?.toString() || "",
                finance_company: deal.finance_company || "",
                salesperson_id: deal.salesperson_id || "",
                notes: deal.notes || "",
                deal_date: deal.deal_date || new Date().toISOString().split("T")[0]
            });
        }
    }, [mode, deal]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "number" ? (value === "" ? "" : parseFloat(value) || 0) : value
        }));
    };

    const handleVehicleSelect = (vehicleId: string) => {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        if (vehicle) {
            setFormData((prev) => ({
                ...prev,
                vehicle_id: vehicleId,
                sale_price: vehicle.retail_price || 0
            }));
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const url = mode === "add" ? "/api/deals" : `/api/deals/${deal?.id}`;
            const method = mode === "add" ? "POST" : "PATCH";

            const payload = {
                vehicle_id: formData.vehicle_id,
                customer_id: formData.customer_id || null,
                deal_status: formData.deal_status,
                sale_price: formData.sale_price,
                down_payment: formData.down_payment || 0,
                trade_in_value: formData.trade_in_value || 0,
                finance_term: formData.finance_term ? parseInt(formData.finance_term) : null,
                interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : null,
                finance_company: formData.finance_company || null,
                salesperson_id: formData.salesperson_id || null,
                notes: formData.notes || null,
                deal_date: formData.deal_date
            };

            const response = await apiFetch(url, {
                method,
                body: payload
            });

            if (!response) {
                throw new Error(`Failed to ${mode} deal`);
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const selectedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);

    return (
        <ModalShell
            open
            onClose={onClose}
            title={mode === "add" ? "Create New Deal" : "Edit Deal"}
            description={mode === "add" ? "Create a new sales deal" : "Update deal information"}
            size="2xl"
            error={error}
            titleIcon={<FileText className="h-5 w-5" />}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="deal-form-modal"
                        variant="premium"
                        loading={loading}
                        leftIcon={<Save className="h-4 w-4" />}
                    >
                        {mode === "add" ? "Create Deal" : "Save Changes"}
                    </Button>
                </>
            }
        >
                        <form id="deal-form-modal" onSubmit={handleSubmit} className="space-y-5">
                            {/* Vehicle Selection */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Vehicle *
                                </label>
                                <div className="relative">
                                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <select
                                        name="vehicle_id"
                                        value={formData.vehicle_id}
                                        onChange={(e) => handleVehicleSelect(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        required
                                        disabled={loadingData}
                                    >
                                        <option value="">Select a vehicle</option>
                                        {vehicles.map((vehicle) => (
                                            <option key={vehicle.id} value={vehicle.id}>
                                                {vehicle.year} {vehicle.make} {vehicle.model} - ${vehicle.retail_price?.toLocaleString()} ({vehicle.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {selectedVehicle && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        VIN: {selectedVehicle.vin} | Retail Price: ${selectedVehicle.retail_price?.toLocaleString()}
                                    </p>
                                )}
                            </div>

                            {/* Customer Selection */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Customer (optional — cash / walk-in)
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <select
                                        name="customer_id"
                                        value={formData.customer_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        disabled={loadingData}
                                    >
                                        <option value="">Cash / walk-in</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name} {customer.email ? `(${customer.email})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Deal Status */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Deal Status *
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <select
                                        name="deal_status"
                                        value={formData.deal_status}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        required
                                    >
                                        <option value="Negotiation">Negotiation</option>
                                        <option value="Down Payment">Down Payment</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Paid Off">Paid Off</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Deal Date */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Deal Date
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="date"
                                        name="deal_date"
                                        value={formData.deal_date}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                                        Sale Price *
                                        <FieldHelp
                                            label="Sale price"
                                            text="Vehicle selling price before tax. Desking subtracts down payment and trade-in to estimate monthly."
                                        />
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="number"
                                            name="sale_price"
                                            value={formData.sale_price || ""}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="0.00"
                                            required
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Down Payment
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="number"
                                            name="down_payment"
                                            value={formData.down_payment || ""}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                                        Trade-in value
                                        <FieldHelp
                                            label="Trade-in value"
                                            text="Amount credited for the customer’s trade. Reduces the amount financed in the desking estimate."
                                        />
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="number"
                                            name="trade_in_value"
                                            value={formData.trade_in_value || ""}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Desking lite — always available; term/rate persist on save */}
                            <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <Percent className="h-4 w-4" />
                                        Desking
                                        <FieldHelp
                                            label="Desking"
                                            text="Estimates monthly payment from sale minus down and trade-in, over term and rate. Not a credit decision or lender commit."
                                        />
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Est. monthly{" "}
                                        <span className="font-bold">
                                            {(() => {
                                                const term = parseInt(formData.finance_term, 10) || 0;
                                                const rate = parseFloat(formData.interest_rate) || 0;
                                                const principal = Math.max(
                                                    0,
                                                    (formData.sale_price || 0) -
                                                        (formData.down_payment || 0) -
                                                        (formData.trade_in_value || 0)
                                                );
                                                if (!term || principal <= 0) return "—";
                                                const r = rate / 100 / 12;
                                                const pay =
                                                    r <= 0
                                                        ? principal / term
                                                        : (principal * r * Math.pow(1 + r, term)) /
                                                          (Math.pow(1 + r, term) - 1);
                                                return new Intl.NumberFormat("en-CA", {
                                                    style: "currency",
                                                    currency: "CAD",
                                                }).format(pay);
                                            })()}
                                        </span>
                                    </p>
                                </div>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">
                                            Term (months)
                                        </label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="number"
                                                name="finance_term"
                                                value={formData.finance_term}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                                placeholder="e.g. 60"
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">
                                            Rate (%)
                                        </label>
                                        <div className="relative">
                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="number"
                                                name="interest_rate"
                                                value={formData.interest_rate}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                                placeholder="e.g. 5.99"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">
                                            Finance company
                                        </label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                name="finance_company"
                                                value={formData.finance_company}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                                placeholder="e.g. TD Auto Finance"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Salesperson */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Salesperson
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <select
                                        name="salesperson_id"
                                        value={formData.salesperson_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                    >
                                        <option value="">Select a salesperson</option>
                                        {salespersons.map((person) => (
                                            <option key={person.id} value={person.id}>
                                                {person.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Notes
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                                    placeholder="Additional notes about this deal..."
                                />
                            </div>

                        </form>
        </ModalShell>
    );
}
