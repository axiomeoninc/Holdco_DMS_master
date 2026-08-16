"use client";

import { useState, useEffect } from "react";
import {
    X,
    Car,
    User,
    Calendar,
    Clock,
    Save,
    Loader2,
    AlertCircle,
    Users,
    FileText,
    Key,
    Image,
    Signature,
    UserPlus,
    Plus,
    Star,
    ClipboardCheck,
} from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface FormCustomerOption {
    id: string;
    name: string;
    email?: string | null;
}

interface FormLeadOption {
    id: string;
    source?: string | null;
    status?: string | null;
    customer?: { name?: string } | null;
}

interface FormVehicleOption {
    id: string;
    year: string | number;
    make: string;
    model: string;
    vin?: string;
    stock_number?: string | null;
}

interface FormUserOption {
    id: string;
    full_name: string;
}

interface TestDrive {
    id: string;
    customer_id: string | null;
    lead_id: string | null;
    vehicle_id: string;
    user_id?: string | null;
    driver_license_number?: string | null;
    driver_license_expiry?: string | null;
    driver_license_image_url?: string | null;
    signature_image_url?: string | null;
    start_time: string | null;
    scheduled_date?: string | null;
    end_time: string | null;
    salesperson_id?: string | null;
    notes: string | null;
    status: string;
    outcome?: string | null;
    created_at: string;
    updated_at: string;
}

interface TestDriveFormModalProps {
    mode: "add" | "edit";
    testDrive?: TestDrive | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function TestDriveFormModal({
    mode,
    testDrive,
    onClose,
    onSuccess
}: TestDriveFormModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customers, setCustomers] = useState<FormCustomerOption[]>([]);
    const [leads, setLeads] = useState<FormLeadOption[]>([]);
    const [vehicles, setVehicles] = useState<FormVehicleOption[]>([]);
    const [users, setUsers] = useState<FormUserOption[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [customerType, setCustomerType] = useState<"customer" | "lead">("customer");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
    const [addingCustomer, setAddingCustomer] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: "",
        lead_id: "",
        vehicle_id: "",
        driver_license_number: "",
        driver_license_expiry: "",
        driver_license_image_url: "",
        signature_image_url: "",
        start_time: "",
        end_time: "",
        salesperson_id: "",
        notes: "",
        status: "Scheduled"
    });
    const [interestStars, setInterestStars] = useState(0);
    const [checklist, setChecklist] = useState({
        licenseVerified: false,
        insuranceOk: false,
        walkaroundDone: false,
        keysReturned: false,
    });

    const PRE_DRIVE = [
        { key: "licenseVerified" as const, label: "Driver's license verified" },
        { key: "insuranceOk" as const, label: "Insurance / liability acknowledged" },
        { key: "walkaroundDone" as const, label: "Vehicle walkaround complete" },
    ];
    const POST_DRIVE = [
        { key: "keysReturned" as const, label: "Keys returned / vehicle inspected" },
    ];

    async function fetchFormData() {
        try {
            const [customersRes, leadsRes, vehiclesRes, usersRes] = await Promise.all([
                fetch("/api/customers?limit=1000", {
                }),
                fetch("/api/leads?limit=1000", {
                }),
                fetch("/api/vehicles?limit=1000&status=Active", {
                }),
                fetch("/api/users?limit=1000", {
                }),
            ]);

            const customersData = await customersRes.json();
            const leadsData = await leadsRes.json();
            const vehiclesData = await vehiclesRes.json();
            const usersData = await usersRes.json();

            setCustomers(customersData.data || []);
            setLeads(leadsData.data || []);
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
        if (mode === "edit" && testDrive) {
            setFormData({
                customer_id: testDrive.customer_id || "",
                lead_id: testDrive.lead_id || "",
                vehicle_id: testDrive.vehicle_id,
                driver_license_number: testDrive.driver_license_number || "",
                driver_license_expiry: testDrive.driver_license_expiry || "",
                driver_license_image_url: testDrive.driver_license_image_url || "",
                signature_image_url: testDrive.signature_image_url || "",
                start_time: (testDrive.start_time || testDrive.scheduled_date)
                    ? String(testDrive.start_time || testDrive.scheduled_date).slice(0, 16)
                    : "",
                end_time: testDrive.end_time ? testDrive.end_time.slice(0, 16) : "",
                salesperson_id: testDrive.user_id || testDrive.salesperson_id || "",
                notes: testDrive.notes || "",
                status: testDrive.status || "Scheduled"
            });
            if (testDrive.customer_id) {
                setCustomerType("customer");
            } else if (testDrive.lead_id) {
                setCustomerType("lead");
            }
            const outcome = (testDrive as TestDrive).outcome || "";
            const m = /interest:(\d)/i.exec(outcome);
            if (m) setInterestStars(Number(m[1]) || 0);
        }
    }, [mode, testDrive]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user types
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
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

            // Select the new customer and switch to customer type
            setFormData((prev) => ({ ...prev, customer_id: newCustomerData.id }));
            setCustomerType("customer");
            setShowAddCustomer(false);
            setNewCustomer({ name: "", email: "", phone: "" });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add customer");
        } finally {
            setAddingCustomer(false);
        }
    }

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Validate customer/lead selection
        if (customerType === "customer" && !formData.customer_id) {
            newErrors.customer_id = "Customer is required";
        }
        if (customerType === "lead" && !formData.lead_id) {
            newErrors.lead_id = "Lead is required";
        }

        // Validate vehicle
        if (!formData.vehicle_id) {
            newErrors.vehicle_id = "Vehicle is required";
        }

        // Validate driver license
        if (!formData.driver_license_number) {
            newErrors.driver_license_number = "Driver license number is required";
        }
        if (!formData.driver_license_expiry) {
            newErrors.driver_license_expiry = "License expiry date is required";
        } else {
            const expiryDate = new Date(formData.driver_license_expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expiryDate < today) {
                newErrors.driver_license_expiry = "License has expired";
            }
        }

        // Validate start time
        if (!formData.start_time) {
            newErrors.start_time = "Start time is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validate before submission
        if (!validateForm()) {
            setError("Please fill in all required fields");
            return;
        }
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const url = mode === "add" ? "/api/test-drives" : `/api/test-drives/${testDrive?.id}`;
            const method = mode === "add" ? "POST" : "PUT";

            // Build payload only with schema-backed fields
            const payload: Record<string, unknown> = {
                vehicle_id: formData.vehicle_id,
                scheduled_date: formData.start_time,
                start_time: formData.start_time,
                status: formData.status || "Scheduled"
            };

            // Only add optional fields if they have values
            if (customerType === "customer" && formData.customer_id) {
                payload.customer_id = formData.customer_id;
            }
            if (customerType === "lead" && formData.lead_id) {
                payload.lead_id = formData.lead_id;
            }
            if (formData.end_time) {
                payload.end_time = formData.end_time;
            }
            if (formData.signature_image_url) {
                payload.signature_image_url = formData.signature_image_url;
            }
            if (formData.notes) {
                payload.notes = formData.notes;
            }
            if (formData.salesperson_id) {
                payload.user_id = formData.salesperson_id;
            }

            // License fields are not persisted columns — keep them in notes for audit honesty
            const licenseBits: string[] = [];
            if (formData.driver_license_number) {
                licenseBits.push(`DL#: ${formData.driver_license_number}`);
            }
            if (formData.driver_license_expiry) {
                licenseBits.push(`DL expiry: ${formData.driver_license_expiry}`);
            }
            if (licenseBits.length > 0) {
                const block = `License:\n${licenseBits.join("\n")}`;
                payload.notes = payload.notes ? `${payload.notes}\n\n${block}` : block;
            }

            const checkedItems = [...PRE_DRIVE, ...POST_DRIVE]
                .filter((item) => checklist[item.key])
                .map((item) => `✓ ${item.label}`);
            if (checkedItems.length > 0) {
                const block = `Checklist:\n${checkedItems.join("\n")}`;
                payload.notes = payload.notes ? `${payload.notes}\n\n${block}` : block;
            }
            if (interestStars > 0 || formData.status === "Completed") {
                payload.outcome = interestStars > 0 ? `interest:${interestStars}` : null;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${mode} test drive`);
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
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
                <div className="relative min-h-screen flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                        <p className="mt-2 text-sm text-gray-500">Loading form data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                <Car className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {mode === "add" ? "Schedule Test Drive" : "Edit Test Drive"}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {mode === "add" ? "Schedule a new vehicle test drive" : "Update test drive details"}
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
                        {/* Error Alert */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Customer Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Customer Type *
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCustomerType("customer")}
                                        className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${customerType === "customer"
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        <Users className="w-4 h-4 inline mr-2" />
                                        Existing Customer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCustomerType("lead")}
                                        className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${customerType === "lead"
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        <UserPlus className="w-4 h-4 inline mr-2" />
                                        Lead
                                    </button>
                                </div>
                            </div>

                            {/* Customer/Lead Selection */}
                            {customerType === "customer" ? (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Select Customer *
                                        </label>
                                        {!showAddCustomer && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAddCustomer(true)}
                                                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add New Customer
                                            </button>
                                        )}
                                    </div>

                                    {showAddCustomer ? (
                                        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-blue-700">Add New Customer</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowAddCustomer(false);
                                                        setNewCustomer({ name: "", email: "", phone: "" });
                                                        setError(null);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={newCustomer.name}
                                                        onChange={handleNewCustomerChange}
                                                        placeholder="Name *"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        value={newCustomer.email}
                                                        onChange={handleNewCustomerChange}
                                                        placeholder="Email"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        value={newCustomer.phone}
                                                        onChange={handleNewCustomerChange}
                                                        placeholder="Phone"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomer}
                                                    disabled={addingCustomer}
                                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
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
                                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <select
                                                name="customer_id"
                                                value={formData.customer_id}
                                                onChange={handleChange}
                                                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white ${
                                                    errors.customer_id
                                                        ? "border-red-500 focus:ring-red-500"
                                                        : "border-gray-200 focus:ring-blue-500"
                                                }`}
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
                                    {errors.customer_id && (
                                        <p className="mt-1 text-xs text-red-500">{errors.customer_id}</p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Select Lead *
                                    </label>
                                    <div className="relative">
                                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <select
                                            name="lead_id"
                                            value={formData.lead_id}
                                            onChange={handleChange}
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white ${
                                                errors.lead_id
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-gray-200 focus:ring-blue-500"
                                            }`}
                                        >
                                            <option value="">Select Lead</option>
                                            {leads.map((lead) => (
                                                <option key={lead.id} value={lead.id}>
                                                    {lead.customer?.name || "Unknown"} - {lead.source} ({lead.status})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.lead_id && (
                                        <p className="mt-1 text-xs text-red-500">{errors.lead_id}</p>
                                    )}
                                </div>
                            )}

                            {/* Vehicle Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Vehicle *
                                </label>
                                <div className="relative">
                                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                        name="vehicle_id"
                                        value={formData.vehicle_id}
                                        onChange={handleChange}
                                        className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white ${
                                            errors.vehicle_id
                                                ? "border-red-500 focus:ring-red-500"
                                                : "border-gray-200 focus:ring-blue-500"
                                        }`}
                                    >
                                        <option value="">Select Vehicle</option>
                                        {vehicles.map((vehicle) => (
                                            <option key={vehicle.id} value={vehicle.id}>
                                                {vehicle.year} {vehicle.make} {vehicle.model} - {vehicle.vin} {vehicle.stock_number ? `(Stock: #${vehicle.stock_number})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {errors.vehicle_id && (
                                    <p className="mt-1 text-xs text-red-500">{errors.vehicle_id}</p>
                                )}
                            </div>

                            {/* Driver License */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        License Number *
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            name="driver_license_number"
                                            value={formData.driver_license_number}
                                            onChange={handleChange}
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                                                errors.driver_license_number
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-gray-200 focus:ring-blue-500"
                                            }`}
                                            placeholder="DL123456"
                                        />
                                    </div>
                                    {errors.driver_license_number && (
                                        <p className="mt-1 text-xs text-red-500">{errors.driver_license_number}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        License Expiry *
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="date"
                                            name="driver_license_expiry"
                                            value={formData.driver_license_expiry}
                                            onChange={handleChange}
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                                                errors.driver_license_expiry
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-gray-200 focus:ring-blue-500"
                                            }`}
                                        />
                                    </div>
                                    {errors.driver_license_expiry && (
                                        <p className="mt-1 text-xs text-red-500">{errors.driver_license_expiry}</p>
                                    )}
                                </div>
                            </div>

                            {/* License Image URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    License Image URL
                                </label>
                                <div className="relative">
                                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="url"
                                        name="driver_license_image_url"
                                        value={formData.driver_license_image_url}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="https://example.com/license.jpg"
                                    />
                                </div>
                            </div>

                            {/* Signature Image URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Signature Image URL
                                </label>
                                <div className="relative">
                                    <Signature className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="url"
                                        name="signature_image_url"
                                        value={formData.signature_image_url}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="https://example.com/signature.jpg"
                                    />
                                </div>
                            </div>

                            {/* Start and End Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Start Time *
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="datetime-local"
                                            name="start_time"
                                            value={formData.start_time}
                                            onChange={handleChange}
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                                                errors.start_time
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-gray-200 focus:ring-blue-500"
                                            }`}
                                        />
                                    </div>
                                    {errors.start_time && (
                                        <p className="mt-1 text-xs text-red-500">{errors.start_time}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        End Time
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="datetime-local"
                                            name="end_time"
                                            value={formData.end_time}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Salesperson and Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Salesperson
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <select
                                            name="salesperson_id"
                                            value={formData.salesperson_id}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                        >
                                            <option value="">Select Salesperson</option>
                                            {users.map((user) => (
                                                <option key={user.id} value={user.id}>
                                                    {user.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Status
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    >
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                        <option value="No Show">No Show</option>
                                    </select>
                                </div>
                            </div>

                            {/* Pre / post checklist + interest */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <ClipboardCheck className="w-4 h-4 text-blue-600" />
                                    Pre-drive checklist
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {PRE_DRIVE.map((item) => (
                                        <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={checklist[item.key]}
                                                onChange={(e) =>
                                                    setChecklist((c) => ({ ...c, [item.key]: e.target.checked }))
                                                }
                                                className="rounded border-gray-300"
                                            />
                                            {item.label}
                                        </label>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-2 border-t border-gray-200">
                                    Post-drive
                                </div>
                                {POST_DRIVE.map((item) => (
                                    <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={checklist[item.key]}
                                            onChange={(e) =>
                                                setChecklist((c) => ({ ...c, [item.key]: e.target.checked }))
                                            }
                                            className="rounded border-gray-300"
                                        />
                                        {item.label}
                                    </label>
                                ))}
                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-1.5">Customer interest</p>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setInterestStars(interestStars === n ? 0 : n)}
                                                className="p-1 rounded hover:bg-white"
                                                title={`${n} star${n === 1 ? "" : "s"}`}
                                            >
                                                <Star
                                                    className={`w-5 h-5 ${
                                                        n <= interestStars
                                                            ? "fill-amber-400 text-amber-400"
                                                            : "text-gray-300"
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                        <span className="ml-2 text-xs text-gray-500">
                                            {interestStars ? `${interestStars}/5` : "Not rated"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Notes
                                </label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        placeholder="Additional notes about the test drive..."
                                    />
                                </div>
                            </div>

                            {/* Actions */}
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
                                            {mode === "add" ? "Scheduling..." : "Saving..."}
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            {mode === "add" ? "Schedule Test Drive" : "Save Changes"}
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