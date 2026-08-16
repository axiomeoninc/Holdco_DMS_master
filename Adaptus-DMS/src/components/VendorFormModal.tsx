"use client";

import { useState } from "react";
import {
    X,
    Save,
    Loader2,
    AlertCircle,
    Store,
    Phone,
    Mail,
    MapPin,
} from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface Vendor {
    id?: string;
    vendor_type?: string;
    vendor_name?: string;
    address?: string | null;
    phone?: string | null;
    gst_number?: string | null;
    hst_number?: string | null;
    pst_number?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
}

const VENDOR_TYPES = [
    "General",
    "Dealer",
    "Auction",
    "Finance",
    "Insurance",
    "Service Provider",
    "Parts Supplier",
    "Lot Photographer",
    "Detailer",
    "Mechanic",
    "Body Shop",
    "Other",
];

interface VendorFormModalProps {
    mode: "add" | "edit";
    vendor?: Vendor | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function VendorFormModal({
    mode,
    vendor,
    onClose,
    onSuccess
}: VendorFormModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        vendor_type: vendor?.vendor_type || "General",
        vendor_name: vendor?.vendor_name || "",
        address: vendor?.address || "",
        phone: vendor?.phone || "",
        gst_number: vendor?.gst_number || "",
        hst_number: vendor?.hst_number || "",
        pst_number: vendor?.pst_number || "",
        city: vendor?.city || "",
        province: vendor?.province || "",
        postal_code: vendor?.postal_code || "",
        contact_name: vendor?.contact_name || "",
        contact_email: vendor?.contact_email || "",
        contact_phone: vendor?.contact_phone || "",
        notes: vendor?.notes || ""
    });

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
            if (!formData.vendor_name.trim()) {
                throw new Error("Vendor name is required");
            }
            const url = vendor?.id ? `/api/vendors/${vendor.id}` : "/api/vendors";
            const method = vendor?.id ? "PATCH" : "POST";

            const payload = {
                vendor_type: formData.vendor_type,
                vendor_name: formData.vendor_name,
                address: formData.address || null,
                phone: formData.phone || null,
                gst_number: formData.gst_number || null,
                hst_number: formData.hst_number || null,
                pst_number: formData.pst_number || null,
                city: formData.city || null,
                province: formData.province || null,
                postal_code: formData.postal_code || null,
                contact_name: formData.contact_name || null,
                contact_email: formData.contact_email || null,
                contact_phone: formData.contact_phone || null,
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
                throw new Error(errorData.error || "Failed to save vendor");
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
                                <Store className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {mode === "edit" ? "Edit Vendor" : "New Vendor"}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {mode === "edit" ? "Update vendor details" : "Add a new vendor or service provider"}
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

                            {/* Vendor Type & Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vendor Type
                                    </label>
                                    <select
                                        name="vendor_type"
                                        value={formData.vendor_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        {VENDOR_TYPES.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vendor Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="vendor_name"
                                        value={formData.vendor_name}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g., ABC Auto Parts"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Address
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="Street address"
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* City, Province, Postal */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        placeholder="City"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Province
                                    </label>
                                    <select
                                        name="province"
                                        value={formData.province}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">Select Province</option>
                                        <option value="Alberta">Alberta</option>
                                        <option value="British Columbia">British Columbia</option>
                                        <option value="Manitoba">Manitoba</option>
                                        <option value="New Brunswick">New Brunswick</option>
                                        <option value="Newfoundland and Labrador">Newfoundland and Labrador</option>
                                        <option value="Northwest Territories">Northwest Territories</option>
                                        <option value="Nova Scotia">Nova Scotia</option>
                                        <option value="Nunavut">Nunavut</option>
                                        <option value="Ontario">Ontario</option>
                                        <option value="Prince Edward Island">Prince Edward Island</option>
                                        <option value="Quebec">Quebec</option>
                                        <option value="Saskatchewan">Saskatchewan</option>
                                        <option value="Yukon">Yukon</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Postal Code
                                    </label>
                                    <input
                                        type="text"
                                        name="postal_code"
                                        value={formData.postal_code}
                                        onChange={handleChange}
                                        placeholder="e.g. A1A 1A1"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="Primary phone number"
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Tax Numbers */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tax Numbers
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">GST Number</label>
                                        <input
                                            type="text"
                                            name="gst_number"
                                            value={formData.gst_number}
                                            onChange={handleChange}
                                            placeholder="GST"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">HST Number</label>
                                        <input
                                            type="text"
                                            name="hst_number"
                                            value={formData.hst_number}
                                            onChange={handleChange}
                                            placeholder="HST"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">PST Number</label>
                                        <input
                                            type="text"
                                            name="pst_number"
                                            value={formData.pst_number}
                                            onChange={handleChange}
                                            placeholder="PST"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contact Person */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Contact Person
                                    </label>
                                    <input
                                        type="text"
                                        name="contact_name"
                                        value={formData.contact_name}
                                        onChange={handleChange}
                                        placeholder="Primary contact name"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Contact Phone
                                    </label>
                                    <input
                                        type="text"
                                        name="contact_phone"
                                        value={formData.contact_phone}
                                        onChange={handleChange}
                                        placeholder="Contact phone"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Contact Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Contact Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="email"
                                        name="contact_email"
                                        value={formData.contact_email}
                                        onChange={handleChange}
                                        placeholder="contact@vendor.com"
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
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
                                    placeholder="Additional notes about this vendor..."
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
                                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {loading ? "Saving..." : "Save Vendor"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
