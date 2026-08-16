"use client";

import { useState, useEffect } from "react";
import {
    Store,
    Plus,
    Search,
    RefreshCw,
    Loader2,
    Edit,
    Trash2,
    Eye,
    Phone,
    Mail,
    MapPin,
    FileText,
    DollarSign,
    Filter,
    Download
} from "lucide-react";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import VendorFormModal from "@/src/components/VendorFormModal";
import VendorDetailsModal from "@/src/components/VendorDetailsModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { toast } from "@/src/lib/toast";

interface Vendor {
    id: string;
    vendor_type: string;
    vendor_name: string;
    address: string | null;
    phone: string | null;
    gst_number: string | null;
    hst_number: string | null;
    pst_number: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    created_at: string;
}

interface ApiResponse {
    data: Vendor[];
    count: number;
    limit: number;
    offset: number;
    totals?: {
        dealerCount: number;
        financeCount: number;
        withPhoneCount: number;
    };
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

export default function VendorsPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    // More Filters
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [createdAtFrom, setCreatedAtFrom] = useState("");
    const [createdAtTo, setCreatedAtTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(10);
    const [vendorTotals, setVendorTotals] = useState({
        dealerCount: 0,
        financeCount: 0,
        withPhoneCount: 0,
    });

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        vendor: Vendor | null;
        loading: boolean;
    }>({ vendor: null, loading: false });
    const [exportLoading, setExportLoading] = useState(false);

    useEffect(() => {
        fetchVendors();
    }, [currentPage, typeFilter, searchTerm, createdAtFrom, createdAtTo]);

    const toCsv = (rows: Record<string, string | number>[]) => {
        const cols = Object.keys(rows[0] || {});
        const escape = (v: string | number) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
        return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
    };

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    };

    async function exportToExcel() {
        setExportLoading(true);
        try {
            let exportUrl = "/api/vendors?limit=10000&offset=0";
            if (typeFilter) exportUrl += `&vendor_type=${encodeURIComponent(typeFilter)}`;
            if (searchTerm) exportUrl += `&q=${encodeURIComponent(searchTerm)}`;
            if (createdAtFrom) exportUrl += `&created_at_from=${createdAtFrom}`;
            if (createdAtTo) exportUrl += `&created_at_to=${createdAtTo}`;

            const response = await fetch(exportUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch vendors (${response.status})`);
            }

            const data = await response.json();
            const exportData: Vendor[] = data.data || [];
            if (exportData.length === 0) {
                throw new Error("No vendors found to export");
            }

            const worksheetData = exportData.map((vendor) => ({
                "Vendor Name": vendor.vendor_name || "",
                "Type": vendor.vendor_type || "",
                "Contact Name": vendor.contact_name || "",
                "Contact Email": vendor.contact_email || "",
                "Contact Phone": vendor.contact_phone || "",
                "Phone": vendor.phone || "",
                "Address": vendor.address || "",
                "City": vendor.city || "",
                "Province": vendor.province || "",
                "Postal Code": vendor.postal_code || "",
                "GST #": vendor.gst_number || "",
                "HST #": vendor.hst_number || "",
                "PST #": vendor.pst_number || "",
                "Notes": vendor.notes || "",
                "Created": vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : "",
            }));

            await downloadXlsx(
                worksheetData,
                "Vendors",
                `vendors-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 16 },
                    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
                    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 12 },
                ]
            );
            const csvCopied = await copyToClipboard(toCsv(worksheetData));
            toast.success(
                `Exported ${exportData.length} vendor${exportData.length === 1 ? "" : "s"}` +
                (csvCopied ? " — CSV copied to clipboard" : "")
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export vendors");
        } finally {
            setExportLoading(false);
        }
    }

    async function fetchVendors() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/vendors?limit=${itemsPerPage}&offset=${offset}`;
            if (typeFilter) url += `&vendor_type=${encodeURIComponent(typeFilter)}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
            if (createdAtFrom) url += `&created_at_from=${createdAtFrom}`;
            if (createdAtTo) url += `&created_at_to=${createdAtTo}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch vendors");
            }

            const data: ApiResponse = await response.json();
            setVendors(data.data);
            setTotalItems(data.count);
            if (data.totals) {
                setVendorTotals({
                    dealerCount: data.totals.dealerCount || 0,
                    financeCount: data.totals.financeCount || 0,
                    withPhoneCount: data.totals.withPhoneCount || 0,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = (vendor: Vendor) => {
        setSelectedVendor(vendor);
        setShowDetailsModal(true);
    };

    const handleEdit = (vendor: Vendor) => {
        setSelectedVendor(vendor);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedVendor(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedVendor(null);
        fetchVendors();
    };

    async function handleDelete(vendor: Vendor) {
        setConfirmDialogData({ vendor, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.vendor) return;

        const vendorId = confirmDialogData.vendor.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/vendors/${vendorId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete vendor");
            }

            setConfirmDialogData({ vendor: null, loading: false });
            setShowConfirmDialog(false);
            setVendors((prev) => prev.filter((v) => v.id !== vendorId));
            setTotalItems((prev) => prev - 1);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const getTypeColor = (type: string) => {
        const key = (type || "").toLowerCase();
        const colors: Record<string, string> = {
            "dealer": "bg-purple-100 text-purple-700",
            "auction": "bg-blue-100 text-blue-700",
            "finance": "bg-green-100 text-green-700",
            "insurance": "bg-yellow-100 text-yellow-700",
            "service provider": "bg-orange-100 text-orange-700",
            "parts supplier": "bg-cyan-100 text-cyan-700",
            "general": "bg-gray-100 text-gray-700",
            "other": "bg-slate-100 text-slate-700"
        };
        return colors[key] || "bg-gray-100 text-gray-700";
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="space-y-6 py-10">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage your vendors and service providers
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchVendors}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={exportToExcel}
                        disabled={exportLoading || totalItems === 0}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export Excel
                    </button>
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Vendor
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Store className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Total Vendors</p>
                            <p className="text-xl font-bold text-gray-900">{totalItems}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Dealers</p>
                            <p className="text-xl font-bold text-purple-600">
                                {vendorTotals.dealerCount}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Finance</p>
                            <p className="text-xl font-bold text-green-600">
                                {vendorTotals.financeCount}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg">
                            <Phone className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">With Phone</p>
                            <p className="text-xl font-bold text-orange-600">
                                {vendorTotals.withPhoneCount}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search vendors..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">All Types</option>
                            {VENDOR_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <div className="relative">
                        <button
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                            className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
                                showMoreFilters ? "bg-blue-50 border-blue-200 text-blue-600" : "border-gray-200 hover:bg-gray-50"
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            More Filters
                            {(createdAtFrom || createdAtTo) && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                        </button>
                        {showMoreFilters && (
                            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Created Date Range</label>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 w-8">From</span>
                                                <input
                                                    type="date"
                                                    value={createdAtFrom}
                                                    onChange={(e) => {
                                                        setCreatedAtFrom(e.target.value);
                                                        setCurrentPage(1);
                                                    }}
                                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 w-8">To</span>
                                                <input
                                                    type="date"
                                                    value={createdAtTo}
                                                    onChange={(e) => {
                                                        setCreatedAtTo(e.target.value);
                                                        setCurrentPage(1);
                                                    }}
                                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => {
                                                setCreatedAtFrom("");
                                                setCreatedAtTo("");
                                                setShowMoreFilters(false);
                                            }}
                                            className="flex-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                        >
                                            Clear All
                                        </button>
                                        <button
                                            onClick={() => setShowMoreFilters(false)}
                                            className="flex-1 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center min-h-[300px]">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <p className="text-sm text-gray-500">Loading vendors...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center min-h-[300px]">
                        <div className="text-center">
                            <p className="text-red-600">{error}</p>
                            <button
                                onClick={fetchVendors}
                                className="mt-2 text-blue-600 hover:underline"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : vendors.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[300px]">
                        <div className="text-center">
                            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No vendors found</p>
                            <button
                                onClick={handleAdd}
                                className="mt-3 text-blue-600 hover:underline"
                            >
                                Add your first vendor
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Contact
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            GST/HST/PST
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {vendors.map((vendor) => (
                                        <tr key={vendor.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900">{vendor.vendor_name}</p>
                                                    {vendor.address && (
                                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <MapPin className="w-3 h-3" />
                                                            {vendor.address}
                                                            {vendor.city && `, ${vendor.city}`}
                                                            {vendor.province && `, ${vendor.province}`}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(vendor.vendor_type)}`}>
                                                    {vendor.vendor_type || "General"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">
                                                    {vendor.contact_name && (
                                                        <p className="text-gray-900">{vendor.contact_name}</p>
                                                    )}
                                                    {vendor.phone && (
                                                        <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <Phone className="w-3 h-3" />
                                                            {vendor.phone}
                                                        </p>
                                                    )}
                                                    {vendor.contact_email && (
                                                        <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3 h-3" />
                                                            {vendor.contact_email}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-600">
                                                    {vendor.gst_number ? (
                                                        <p>GST: {vendor.gst_number}</p>
                                                    ) : (
                                                        <p className="text-gray-400">-</p>
                                                    )}
                                                    {vendor.hst_number && <p>HST: {vendor.hst_number}</p>}
                                                    {vendor.pst_number && <p>PST: {vendor.pst_number}</p>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {formatDate(vendor.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleViewDetails(vendor)}
                                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(vendor)}
                                                        className="p-2 text-gray-400 hover:text-amber-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(vendor)}
                                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden divide-y divide-gray-200">
                            {vendors.length === 0 ? (
                                <div className="flex items-center justify-center min-h-[300px]">
                                    <div className="text-center">
                                        <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No vendors found</p>
                                        <button
                                            onClick={handleAdd}
                                            className="mt-3 text-blue-600 hover:underline"
                                        >
                                            Add your first vendor
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                vendors.map((vendor) => (
                                    <div key={vendor.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{vendor.vendor_name}</p>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(vendor.vendor_type)}`}>
                                                    {vendor.vendor_type || "General"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleViewDetails(vendor)}
                                                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-4 h-4 text-blue-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(vendor)}
                                                    className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                >
                                                    <Edit className="w-4 h-4 text-amber-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(vendor)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                            {vendor.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                    <span>{vendor.phone}</span>
                                                </div>
                                            )}
                                            {vendor.contact_email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="truncate">{vendor.contact_email}</span>
                                                </div>
                                            )}
                                            {vendor.address && (
                                                <div className="col-span-2 flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="truncate">{vendor.address}{vendor.city && `, ${vendor.city}`}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                                <p className="text-sm text-gray-500">
                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} vendors
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {showFormModal && (
                <VendorFormModal
                    mode={formMode}
                    vendor={selectedVendor}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedVendor(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showDetailsModal && selectedVendor && (
                <VendorDetailsModal
                    vendor={selectedVendor}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedVendor(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        setFormMode("edit");
                        setShowFormModal(true);
                    }}
                />
            )}

            {showConfirmDialog && confirmDialogData.vendor && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Vendor"
                    message={`Are you sure you want to delete "${confirmDialogData.vendor.vendor_name}"? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ vendor: null, loading: false });
                    }}
                />
            )}
        </div>
    );
}
