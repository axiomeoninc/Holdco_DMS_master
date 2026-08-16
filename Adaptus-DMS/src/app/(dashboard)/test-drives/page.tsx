"use client";

import { useState, useEffect } from "react";
import {
    Car,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    Download,
    RefreshCw,
    Loader2,
    AlertCircle,
    Calendar,
    Clock,
    User,
    Mail,
    Phone,
    CheckCircle,
    XCircle,
    Users,
    FileText
} from "lucide-react";
import TestDriveDetailsModal from "@/src/components/TestDriveDetailsModal";
import TestDriveFormModal from "@/src/components/TestDriveFormModal";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { downloadXlsx } from "@/src/lib/export/download-xlsx";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { DatePicker } from "@/src/components/ui/date-picker";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";

interface TestDrive {
    id: string;
    customer_id: string | null;
    lead_id: string | null;
    vehicle_id: string;
    driver_license_number: string;
    driver_license_expiry: string;
    driver_license_image_url: string | null;
    signature_image_url: string | null;
    start_time: string | null;
    scheduled_date?: string | null;
    end_time: string | null;
    salesperson_id: string | null;
    notes: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar: string | null;
    } | null;
    lead: {
        id: string;
        source: string;
        status: string;
        customer: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        } | null;
    } | null;
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
        vin: string;
        stock_number: string | null;
    } | null;
    salesperson: {
        id: string;
        full_name: string;
        email: string;
        avatar: string | null;
    } | null;
}

interface ApiResponse {
    data: TestDrive[];
    count: number;
    limit: number;
    offset: number;
}

export default function TestDrivesPage() {
    const [testDrives, setTestDrives] = useState<TestDrive[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);
    const [itemsPerPage] = useState(10);

    // More Filters
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [scheduledDateFrom, setScheduledDateFrom] = useState("");
    const [scheduledDateTo, setScheduledDateTo] = useState("");
    const [vehicleFilter, setVehicleFilter] = useState("");

    // Modal states
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedTestDrive, setSelectedTestDrive] = useState<TestDrive | null>(null);

    // Confirm dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{
        testDrive: TestDrive | null;
        loading: boolean;
    }>({ testDrive: null, loading: false });

    // User permissions
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");

    // Permission helpers
    const canWrite = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:write`);
    };

    const canDelete = (resource: string): boolean => {
        if (userRole === "Admin") return true;
        return userPermissions.includes(`${resource}:delete`);
    };

    useEffect(() => {
        fetchTestDrives();
        fetchUserPermissions();
    }, [currentPage, statusFilter, searchTerm, scheduledDateFrom, scheduledDateTo, vehicleFilter]);

    async function fetchUserPermissions() {
        try {
            const response = await fetch("/api/me", {
            });
            if (response.ok) {
                const data = await response.json();
                setUserPermissions(data.data.user_permissions || []);
                setUserRole(data.data.role || "");
            }
        } catch (error) {
            console.error("Error fetching user permissions:", error);
        }
    }

    async function fetchTestDrives() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/test-drives?limit=${itemsPerPage}&offset=${offset}`;
            if (statusFilter) url += `&status=${statusFilter}`;
            if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
            if (scheduledDateFrom) url += `&scheduled_date_from=${scheduledDateFrom}`;
            if (scheduledDateTo) url += `&scheduled_date_to=${scheduledDateTo}`;
            if (vehicleFilter) url += `&vehicle_id=${vehicleFilter}`;

            const response = await fetch(url, {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch test drives");
            }

            const data: ApiResponse = await response.json();
            setTestDrives(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const toCsv = (rows: Record<string, string>[]) => {
        const cols = Object.keys(rows[0] || {});
        const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
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

            const response = await fetch("/api/test-drives?limit=10000", {
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch test drives (${response.status})`);
            }

            const data = (await response.json()) as { data: TestDrive[] };
            const exportData = data.data || [];

            if (exportData.length === 0) {
                throw new Error("No test drives found to export");
            }

            const worksheetData = exportData.map((td) => ({
                "Customer": td.customer?.name || "Unknown",
                "Email": td.customer?.email || "",
                "Phone": td.customer?.phone || "",
                "Vehicle": td.vehicle ? `${td.vehicle.year} ${td.vehicle.make} ${td.vehicle.model}` : "",
                "VIN": td.vehicle?.vin || "",
                "Driver License": td.driver_license_number || "",
                "Status": td.status || "",
                "Scheduled Date": td.start_time ? new Date(td.start_time).toLocaleDateString() : "",
                "Scheduled Time": td.start_time ? new Date(td.start_time).toLocaleTimeString() : "",
                "Salesperson": td.salesperson?.full_name || "",
                "Notes": td.notes || ""
            }));

            await downloadXlsx(
                worksheetData,
                "Test Drives",
                `test-drives-export-${new Date().toISOString().split("T")[0]}.xlsx`,
                [
                    { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 25 },
                    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
                    { wch: 15 }, { wch: 20 }, { wch: 30 },
                ]
            );
            const csvCopied = await copyToClipboard(toCsv(worksheetData));
            toast.success(
                `Exported ${exportData.length} test drive${exportData.length === 1 ? "" : "s"}` +
                (csvCopied ? " — CSV copied to clipboard" : "")
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to export test drives");
        } finally {
            setExportLoading(false);
        }
    }

    const handleViewDetails = (testDrive: TestDrive) => {
        setSelectedTestDrive(testDrive);
        setShowDetailsModal(true);
    };

    const handleEdit = (testDrive: TestDrive) => {
        setSelectedTestDrive(testDrive);
        setFormMode("edit");
        setShowFormModal(true);
    };

    const handleAdd = () => {
        setSelectedTestDrive(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedTestDrive(null);
        fetchTestDrives();
    };

    async function handleDelete(testDrive: TestDrive) {
        setConfirmDialogData({ testDrive, loading: false });
        setShowConfirmDialog(true);
    }

    async function confirmDelete() {
        if (!confirmDialogData.testDrive) return;

        const testDriveId = confirmDialogData.testDrive.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/test-drives/${testDriveId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete test drive");
            }

            // Clear dialog state
            setConfirmDialogData({ testDrive: null, loading: false });
            setShowConfirmDialog(false);

            // Remove from local state immediately for faster UX
            setTestDrives((prev) => prev.filter((t) => t.id !== testDriveId));
            setTotalItems((prev) => prev - 1);

            // Re-fetch to ensure consistency
            fetchTestDrives();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            Scheduled: "bg-primary-100 text-primary",
            "In Progress": "bg-yellow-100 text-warning",
            Completed: "bg-green-100 text-success",
            Cancelled: "bg-destructive-100 text-destructive",
            "No Show": "bg-muted text-foreground"
        };
        return colors[status] || "bg-muted text-foreground";
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Scheduled":
                return <Clock className="w-4 h-4 text-primary" />;
            case "In Progress":
                return <Loader2 className="w-4 h-4 text-warning" />;
            case "Completed":
                return <CheckCircle className="w-4 h-4 text-success" />;
            case "Cancelled":
                return <XCircle className="w-4 h-4 text-destructive" />;
            case "No Show":
                return <XCircle className="w-4 h-4 text-foreground/80" />;
            default:
                return null;
        }
    };

    const formatDateTime = (date: string | null | undefined) => {
        if (!date) return "—";
        const d = new Date(date);
        if (isNaN(d.getTime()) || d.getFullYear() < 1971) return "—";
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getCustomerName = (testDrive: TestDrive) => {
        if (testDrive.customer) {
            return testDrive.customer.name;
        }
        if (testDrive.lead?.customer) {
            return testDrive.lead.customer.name;
        }
        return "Unknown";
    };

    const getCustomerEmail = (testDrive: TestDrive) => {
        if (testDrive.customer) {
            return testDrive.customer.email;
        }
        if (testDrive.lead?.customer) {
            return testDrive.lead.customer.email;
        }
        return null;
    };

    const getCustomerPhone = (testDrive: TestDrive) => {
        if (testDrive.customer) {
            return testDrive.customer.phone;
        }
        if (testDrive.lead?.customer) {
            return testDrive.lead.customer.phone;
        }
        return null;
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="animate-fade-in space-y-3 px-3 py-4 sm:px-5">
            <PageHeader
                title="Test Drives"
                description="Manage vehicle test drives and appointments"
                icon={Car}
                actions={
                    <>
                        <Button variant="outline" onClick={fetchTestDrives}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                        {canWrite("test_drives") && (
                            <Button variant="premium" onClick={handleAdd}>
                                <Plus className="h-4 w-4 mr-2" />
                                Schedule Test Drive
                            </Button>
                        )}
                    </>
                }
            />

            {/* Filters */}
            <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                        <input
                            type="text"
                            placeholder="Search by customer name, vehicle, or VIN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-white"
                        >
                            <option value="">All Status</option>
                            <option value="Scheduled">Scheduled</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="No Show">No Show</option>
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setShowMoreFilters(!showMoreFilters)}
                                className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
                                    showMoreFilters ? "bg-primary-50 border-blue-200 text-primary" : "border-border hover:bg-muted/40"
                                }`}
                            >
                                <Filter className="w-4 h-4" />
                                More Filters
                                {(scheduledDateFrom || scheduledDateTo || vehicleFilter) && (
                                    <span className="w-2 h-2 bg-primary rounded-full" />
                                )}
                            </button>
                            {showMoreFilters && (
                                <div className="absolute right-0 mt-2 w-80 bg-white border border-border rounded-xl shadow-lg z-50 p-4">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scheduled Date Range</label>
                                            <div className="flex flex-col gap-2">
                                                <DatePicker
                                                    label="From"
                                                    value={scheduledDateFrom}
                                                    onChange={setScheduledDateFrom}
                                                />
                                                <DatePicker
                                                    label="To"
                                                    value={scheduledDateTo}
                                                    onChange={setScheduledDateTo}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={() => {
                                                    setScheduledDateFrom("");
                                                    setScheduledDateTo("");
                                                    setVehicleFilter("");
                                                }}
                                                className="flex-1 px-3 py-1.5 text-xs text-foreground/80 border border-border rounded-lg hover:bg-muted/40"
                                            >
                                                Clear All
                                            </button>
                                            <button
                                                onClick={() => setShowMoreFilters(false)}
                                                className="flex-1 px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={exportToExcel}
                            disabled={exportLoading}
                            className="px-4 py-2 border border-border rounded-lg hover:bg-muted/40 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {exportLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/40 border-b border-border">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Vehicle
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Date & Time
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Salesperson
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                                        <p className="mt-2 text-sm text-muted-foreground">Loading test drives...</p>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                                        <p className="mt-2 text-sm text-destructive">{error}</p>
                                        <button
                                            onClick={fetchTestDrives}
                                            className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary"
                                        >
                                            Try Again
                                        </button>
                                    </td>
                                </tr>
                            ) : testDrives.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <Car className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                        <p className="mt-2 text-sm text-muted-foreground">No test drives found</p>
                                        <button
                                            onClick={handleAdd}
                                            className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary"
                                        >
                                            Schedule First Test Drive
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                testDrives.map((testDrive) => (
                                    <tr key={testDrive.id} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                                                    {getCustomerName(testDrive).split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {getCustomerName(testDrive)}
                                                    </p>
                                                    {getCustomerEmail(testDrive) && (
                                                        <div className="flex items-center gap-1">
                                                            <Mail className="w-3 h-3 text-muted-foreground/70" />
                                                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                                                {getCustomerEmail(testDrive)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {getCustomerPhone(testDrive) && (
                                                        <div className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3 text-muted-foreground/70" />
                                                            <span className="text-xs text-muted-foreground">
                                                                {getCustomerPhone(testDrive)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {testDrive.vehicle ? (
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {testDrive.vehicle.year} {testDrive.vehicle.make} {testDrive.vehicle.model}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-mono">
                                                        VIN: {testDrive.vehicle.vin}
                                                    </p>
                                                    {testDrive.vehicle.stock_number && (
                                                        <p className="text-xs text-muted-foreground/70">
                                                            Stock: #{testDrive.vehicle.stock_number}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground/70">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-foreground">
                                                    {formatDateTime(testDrive.start_time ?? testDrive.scheduled_date)}
                                                </span>
                                                {testDrive.end_time && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Ends: {new Date(testDrive.end_time).toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-foreground/80">
                                                {testDrive.salesperson?.full_name || "Unassigned"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {getStatusIcon(testDrive.status || "Scheduled")}
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(testDrive.status || "Scheduled")}`}>
                                                    {testDrive.status || "Scheduled"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleViewDetails(testDrive)}
                                                    className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4 text-primary" />
                                                </button>
                                                {canWrite("test_drives") && (
                                                    <button
                                                        onClick={() => handleEdit(testDrive)}
                                                        className="p-1.5 hover:bg-warning-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4 text-warning" />
                                                    </button>
                                                )}
                                                {canDelete("test_drives") && (
                                                    <button
                                                        onClick={() => handleDelete(testDrive)}
                                                        className="p-1.5 hover:bg-destructive-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </button>
                                                )}
                                                <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground/70" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-border">
                    {loading ? (
                        <div className="px-4 py-12 text-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                            <p className="mt-2 text-sm text-muted-foreground">Loading test drives...</p>
                        </div>
                    ) : error ? (
                        <div className="px-4 py-12 text-center">
                            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                            <p className="mt-2 text-sm text-destructive">{error}</p>
                            <button
                                onClick={fetchTestDrives}
                                className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : testDrives.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <Car className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                            <p className="mt-2 text-sm text-muted-foreground">No test drives found</p>
                            <button
                                onClick={handleAdd}
                                className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary"
                            >
                                Schedule First Test Drive
                            </button>
                        </div>
                    ) : (
                        testDrives.map((testDrive) => (
                            <div key={testDrive.id} className="p-4 hover:bg-muted/40 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                                            {getCustomerName(testDrive).split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{getCustomerName(testDrive)}</p>
                                            {getCustomerPhone(testDrive) && (
                                                <p className="text-xs text-muted-foreground">{getCustomerPhone(testDrive)}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleViewDetails(testDrive)}
                                            className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                                        >
                                            <Eye className="w-4 h-4 text-primary" />
                                        </button>
                                        {canWrite("test_drives") && (
                                            <button
                                                onClick={() => handleEdit(testDrive)}
                                                className="p-1.5 hover:bg-warning-50 rounded-lg transition-colors"
                                            >
                                                <Edit className="w-4 h-4 text-warning" />
                                            </button>
                                        )}
                                        {canDelete("test_drives") && (
                                            <button
                                                onClick={() => handleDelete(testDrive)}
                                                className="p-1.5 hover:bg-destructive-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {getStatusIcon(testDrive.status || "Scheduled")}
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(testDrive.status || "Scheduled")}`}>
                                        {testDrive.status || "Scheduled"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div>
                                        <span className="font-medium text-muted-foreground/70">Vehicle:</span>{" "}
                                        {testDrive.vehicle ? `${testDrive.vehicle.year} ${testDrive.vehicle.make} ${testDrive.vehicle.model}` : "N/A"}
                                    </div>
                                    <div>
                                        <span className="font-medium text-muted-foreground/70">Salesperson:</span>{" "}
                                        {testDrive.salesperson?.full_name || "Unassigned"}
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-muted-foreground/70">Date:</span> {formatDateTime(testDrive.start_time ?? testDrive.scheduled_date)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {!loading && !error && testDrives.length > 0 && (
                    <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} test drives
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-foreground/80">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>


            {/* Modals */}
            {showDetailsModal && selectedTestDrive && (
                <TestDriveDetailsModal
                    testDrive={selectedTestDrive}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedTestDrive(null);
                    }}
                    onEdit={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedTestDrive);
                    }}
                />
            )}

            {showFormModal && (
                <TestDriveFormModal
                    mode={formMode}
                    testDrive={selectedTestDrive}
                    onClose={() => {
                        setShowFormModal(false);
                        setSelectedTestDrive(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.testDrive && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Test Drive"
                    message={`Are you sure you want to delete this test drive? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setShowConfirmDialog(false);
                        setConfirmDialogData({ testDrive: null, loading: false });
                    }}
                />
            )}
        </div>
    );
}