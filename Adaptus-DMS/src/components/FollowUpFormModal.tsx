"use client";

import { useState, useEffect } from "react";
import {
    X,
    Save,
    Loader2,
    AlertCircle,
    Calendar,
    Clock,
    FileText,
} from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface Lead {
    id: string;
    source: string;
    status: string;
    customer?: {
        name: string;
    };
}

interface UserData {
    id: string;
    full_name: string;
    email: string;
}

interface FollowUp {
    id?: string;
    title: string;
    description: string | null;
    customer_id: string | null;
    lead_id: string | null;
    assigned_to: string | null;
    follow_up_date: string;
    follow_up_time: string | null;
    priority: string;
    status: string;
    notes: string | null;
    customer?: Customer | null;
    lead?: Lead | null;
    assigned_user?: UserData | null;
}

interface FollowUpFormModalProps {
    mode: "add" | "edit";
    followUp?: FollowUp | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function FollowUpFormModal({
    mode,
    followUp,
    onClose,
    onSuccess
}: FollowUpFormModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        customer_id: string;
        lead_id: string;
        assigned_to: string;
        follow_up_date: string;
        follow_up_time: string;
        priority: string;
        status: string;
        notes: string;
    }>({
        title: "",
        description: "",
        customer_id: "",
        lead_id: "",
        assigned_to: "",
        follow_up_date: new Date().toISOString().split("T")[0],
        follow_up_time: "",
        priority: "Medium",
        status: "Pending",
        notes: ""
    });

    async function fetchData() {
        try {
            const [customersRes, leadsRes, usersRes] = await Promise.all([
                fetch("/api/customers?limit=1000", {
                }),
                fetch("/api/leads?limit=1000", {
                }),
                fetch("/api/users?limit=1000", {
                }),
            ]);

            const [customersData, leadsData, usersData] = await Promise.all([
                customersRes.json(),
                leadsRes.json(),
                usersRes.json(),
            ]);

            setCustomers(customersData.data || []);
            setLeads(leadsData.data || []);
            setUsers(usersData.data || []);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoadingData(false);
        }
    }
    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (followUp && mode === "edit") {
            setFormData({
                title: followUp.title || "",
                description: followUp.description || "",
                customer_id: followUp.customer_id || "",
                lead_id: followUp.lead_id || "",
                assigned_to: followUp.assigned_to || "",
                follow_up_date: followUp.follow_up_date?.split("T")[0] || "",
                follow_up_time: followUp.follow_up_time || "",
                priority: followUp.priority || "Medium",
                status: followUp.status || "Pending",
                notes: followUp.notes || ""
            });
        }
    }, [followUp, mode]);

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
            const url = followUp?.id ? `/api/follow-ups/${followUp.id}` : "/api/follow-ups";
            const method = followUp?.id ? "PATCH" : "POST";

            const payload = {
                title: formData.title,
                description: formData.description || null,
                customer_id: formData.customer_id || null,
                lead_id: formData.lead_id || null,
                assigned_to: formData.assigned_to || null,
                follow_up_date: formData.follow_up_date,
                follow_up_time: formData.follow_up_time || null,
                priority: formData.priority,
                status: formData.status,
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
                throw new Error(errorData.error || "Failed to save follow-up");
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {mode === "edit" ? "Edit Follow-up" : "New Follow-up"}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Schedule and track follow-ups
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

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                        <div className="p-6 space-y-6">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-600">{error}</p>
                                    </div>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                    placeholder="e.g., Follow up on test drive interest"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Add notes about this follow-up..."
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            {/* Customer & Lead */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Customer
                                    </label>
                                    <select
                                        name="customer_id"
                                        value={formData.customer_id}
                                        onChange={handleChange}
                                        disabled={loadingData}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">Select customer...</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Lead
                                    </label>
                                    <select
                                        name="lead_id"
                                        value={formData.lead_id}
                                        onChange={handleChange}
                                        disabled={loadingData}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">Select lead...</option>
                                        {leads.map((lead) => (
                                            <option key={lead.id} value={lead.id}>
                                                {lead.customer?.name || `Lead ${lead.id.slice(0, 8)}`} - {lead.source}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Assigned To & Priority */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Assigned To
                                    </label>
                                    <select
                                        name="assigned_to"
                                        value={formData.assigned_to}
                                        onChange={handleChange}
                                        disabled={loadingData}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Priority
                                    </label>
                                    <select
                                        name="priority"
                                        value={formData.priority}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Follow-up Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="date"
                                            name="follow_up_date"
                                            value={formData.follow_up_date}
                                            onChange={handleChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Follow-up Time
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="time"
                                            name="follow_up_time"
                                            value={formData.follow_up_time}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Additional notes..."
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {loading ? "Saving..." : "Save Follow-up"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
