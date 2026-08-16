"use client";

import { useState, useEffect } from "react";
import {
    X,
    User,
    Save,
    Loader2,
    UserPlus,
    Users,
    Car,
    MessageSquare,
    Plus,
} from "lucide-react";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { Button } from "@/src/components/ui/Button";

interface CustomerOption {
    id: string;
    name: string;
    email?: string | null;
}

interface VehicleOption {
    id: string;
    year: string | number;
    make: string;
    model: string;
    stock_number?: string | null;
}

interface UserOption {
    id: string;
    full_name: string;
}

interface Lead {
    id: string;
    customer_id: string;
    source: string;
    status: string;
    interest_vehicle_id: string | null;
    assigned_to: string | null;
    notes: string | null;
    lead_creation_date: string;
    last_engagement: string;
    created_at: string;
    updated_at: string;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar: string | null;
    } | null;
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
    } | null;
    assigned_user: {
        id: string;
        full_name: string;
        email: string;
        avatar: string | null;
    } | null;
}

interface LeadFormModalProps {
    mode: "add" | "edit";
    lead?: Lead | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function LeadFormModal({
    mode,
    lead,
    onClose,
    onSuccess
}: LeadFormModalProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
    const [addingCustomer, setAddingCustomer] = useState(false);
    const [formData, setFormData] = useState({
        customer_id: "",
        source: "Website",
        status: "Not Started",
        interest_vehicle_id: "",
        assigned_to: "",
        notes: ""
    });

    async function fetchFormData() {
        try {
            // Fetch customers, vehicles, and users in parallel
            const [customersRes, vehiclesRes, usersRes] = await Promise.all([
                fetch("/api/customers?limit=1000", {
                }),
                fetch("/api/vehicles?limit=1000&status=Active", {
                }),
                fetch("/api/users?limit=1000", {
                }),
            ]);

            const customersData = await customersRes.json();
            const vehiclesData = await vehiclesRes.json();
            const usersData = await usersRes.json();

            setCustomers(customersData.data || []);
            setVehicles(vehiclesData.data || []);
            setUsers(usersData.data || []);
        } catch (error) {
            console.error("Error fetching form data:", error);
        } finally {
            setLoadingData(false);
        }
    }
    useEffect(() => {
        fetchFormData();
    }, []);

    useEffect(() => {
        if (mode === "edit" && lead) {
            setFormData({
                customer_id: lead.customer_id,
                source: lead.source,
                status: lead.status,
                interest_vehicle_id: lead.interest_vehicle_id || "",
                assigned_to: lead.assigned_to || "",
                notes: lead.notes || ""
            });
        }
    }, [mode, lead]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewCustomer((prev) => ({ ...prev, [name]: value }));
    };

    async function handleAddCustomer() {
        if (!newCustomer.name.trim()) {
            setError("Customer name is required");
            return;
        }

        setAddingCustomer(true);
        setError(null);

        try {
            const response = await fetch("/api/customers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(newCustomer)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to add customer");
            }

            const { data: newCustomerData } = await response.json();

            // Refresh customers list
            const customersRes = await fetch("/api/customers?limit=1000", {
            });
            const customersData = await customersRes.json();
            setCustomers(customersData.data || []);

            // Select the new customer
            setFormData((prev) => ({ ...prev, customer_id: newCustomerData.id }));
            setShowAddCustomer(false);
            setNewCustomer({ name: "", email: "", phone: "" });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add customer");
        } finally {
            setAddingCustomer(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const url = mode === "add" ? "/api/leads" : `/api/leads/${lead?.id}`;
            const method = mode === "add" ? "POST" : "PATCH";

            const payload = {
                customer_id: formData.customer_id,
                source: formData.source,
                status: formData.status,
                interest_vehicle_id: formData.interest_vehicle_id || null,
                assigned_to: formData.assigned_to || null,
                notes: formData.notes || null
            };

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${mode} lead`);
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    if (loadingData) {
        return (
            <ModalShell open onClose={onClose} title="Loading" size="sm" hideCloseButton>
                <div className="flex flex-col items-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading form data...</p>
                </div>
            </ModalShell>
        );
    }

    return (
        <ModalShell
            open
            onClose={onClose}
            title={mode === "add" ? "Add New Lead" : "Edit Lead"}
            description={mode === "add" ? "Create a new sales lead" : "Update lead information"}
            size="2xl"
            error={error}
            titleIcon={
                mode === "add" ? (
                    <UserPlus className="h-5 w-5" />
                ) : (
                    <Users className="h-5 w-5" />
                )
            }
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="lead-form-modal"
                        variant="premium"
                        loading={loading}
                        leftIcon={<Save className="h-4 w-4" />}
                    >
                        {mode === "add" ? "Add Lead" : "Save Changes"}
                    </Button>
                </>
            }
        >
                        <form id="lead-form-modal" onSubmit={handleSubmit} className="space-y-5">
                            {/* Customer */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-foreground">
                                        Customer *
                                    </label>
                                    {!showAddCustomer && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddCustomer(true)}
                                            className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add New Customer
                                        </button>
                                    )}
                                </div>

                                {showAddCustomer ? (
                                    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-primary">Add New Customer</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddCustomer(false);
                                                    setNewCustomer({ name: "", email: "", phone: "" });
                                                    setError(null);
                                                }}
                                                className="text-muted-foreground hover:text-muted-foreground"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                                            <div className="min-w-0">
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={newCustomer.name}
                                                    onChange={handleNewCustomerChange}
                                                    placeholder="Name *"
                                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                                    required
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={newCustomer.email}
                                                    onChange={handleNewCustomerChange}
                                                    placeholder="Email"
                                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={newCustomer.phone}
                                                    onChange={handleNewCustomerChange}
                                                    placeholder="Phone"
                                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddCustomer(false);
                                                    setNewCustomer({ name: "", email: "", phone: "" });
                                                }}
                                                className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleAddCustomer}
                                                disabled={addingCustomer}
                                                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {addingCustomer ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Adding...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="w-3 h-3" />
                                                        Add Customer
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <select
                                            name="customer_id"
                                            value={formData.customer_id}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                            required
                                        >
                                            <option value="">Select Customer</option>
                                            {customers.map((customer) => (
                                                <option key={customer.id} value={customer.id}>
                                                    {customer.name} {customer.email ? `(${customer.email})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Source and Status */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Source *
                                    </label>
                                    <select
                                        name="source"
                                        value={formData.source}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        required
                                    >
                                        <option value="Website">Website</option>
                                        <option value="Referral">Referral</option>
                                        <option value="Event">Event</option>
                                        <option value="Walk-in">Walk-in</option>
                                        <option value="Facebook">Facebook</option>
                                        <option value="Craigslist">Craigslist</option>
                                        <option value="Kijiji">Kijiji</option>
                                        <option value="Phone">Phone</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Status *
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        required
                                    >
                                        <option value="Not Started">Not Started</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Qualified">Qualified</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                </div>
                            </div>

                            {/* Vehicle Interest and Assigned To */}
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Vehicle Interest
                                    </label>
                                    <div className="relative">
                                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <select
                                            name="interest_vehicle_id"
                                            value={formData.interest_vehicle_id}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        >
                                            <option value="">None</option>
                                            {vehicles.map((vehicle) => (
                                                <option key={vehicle.id} value={vehicle.id}>
                                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                                    {vehicle.stock_number ? ` (${vehicle.stock_number})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Assigned To
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <select
                                            name="assigned_to"
                                            value={formData.assigned_to}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
                                        >
                                            <option value="">Unassigned</option>
                                            {users.map((user) => (
                                                <option key={user.id} value={user.id}>
                                                    {user.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Notes
                                </label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                                        placeholder="Additional notes about this lead..."
                                    />
                                </div>
                            </div>

                        </form>
        </ModalShell>
    );
}