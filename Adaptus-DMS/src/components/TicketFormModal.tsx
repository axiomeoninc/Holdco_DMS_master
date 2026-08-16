"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Ticket {
    id?: string;
    subject: string;
    description?: string | null;
    assigned_to?: string | null;
    created_by?: string | null;
    priority?: string;
    status?: string;
}

interface TicketFormModalProps {
    mode: "add" | "edit";
    ticket?: Ticket | null;
    onClose: () => void;
    onSuccess: () => void;
}

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

export default function TicketFormModal({
    mode,
    ticket,
    onClose,
    onSuccess
}: TicketFormModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [formData, setFormData] = useState({
        subject: "",
        description: "",
        assigned_to: "",
        priority: "Medium",
        status: "Open"
    });

    useEffect(() => {
        if (ticket) {
            setFormData({
                subject: ticket.subject || "",
                description: ticket.description || "",
                assigned_to: ticket.assigned_to || "",
                priority: ticket.priority || "Medium",
                status: ticket.status || "Open"
            });
        }
    }, [ticket]);

    async function fetchUsers() {
        try {
            setLoadingUsers(true);
            const response = await fetch("/api/users?limit=100", {
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoadingUsers(false);
        }
    }
    useEffect(() => {
        fetchUsers();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.subject.trim()) {
            setError("Subject is required");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload = {
                subject: formData.subject.trim(),
                description: formData.description.trim() || null,
                assigned_to: formData.assigned_to || null,
                priority: formData.priority,
                status: formData.status
            };

            const url = mode === "edit" && ticket?.id ? `/api/tickets/${ticket.id}` : "/api/tickets";
            const method = mode === "edit" ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save ticket");
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {mode === "add" ? "Create New Ticket" : "Edit Ticket"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="Enter ticket subject"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe the issue or request"
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Priority & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {PRIORITIES.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Assigned To */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Assigned To
                        </label>
                        <select
                            value={formData.assigned_to}
                            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                            disabled={loadingUsers}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select a user</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.full_name || user.email}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? "Saving..." : mode === "add" ? "Create Ticket" : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
