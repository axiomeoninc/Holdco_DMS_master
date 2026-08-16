"use client";

import { useState } from "react";
import {
    X,
    Search,
    Loader2,
    AlertCircle,
    CheckCircle,
    Car,
    Info,
    ExternalLink,
    FileText,
} from "lucide-react";

import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface VehicleSpec {
    vin: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    engine?: string;
    body_style?: string;
    fuel_type?: string;
    transmission?: string;
    drivetrain?: string;
    exterior_color?: string;
    interior_color?: string;
}

interface CarfaxReport {
    id?: string;
    vehicle_id?: string;
    vin: string;
    ownership_count?: number;
    accident_count?: number;
    service_records?: boolean;
    title_status?: string;
    report_url?: string;
}

interface VINLookupModalProps {
    onClose: () => void;
    onVinFound: (specs: VehicleSpec) => void;
    onCarfaxRetrieved?: (report: CarfaxReport) => void;
    existingVin?: string;
}

export default function VINLookupModal({
    onClose,
    onVinFound,
    onCarfaxRetrieved: _onCarfaxRetrieved,
    existingVin
}: VINLookupModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vin, setVin] = useState(existingVin || "");
    const [vehicleSpec, setVehicleSpec] = useState<VehicleSpec | null>(null);
    const [carfaxReport, setCarfaxReport] = useState<CarfaxReport | null>(null);

    const validateVIN = (v: string): boolean => {
        // Basic VIN validation (17 characters, no I, O, Q)
        const cleaned = v.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
        return cleaned.length === 17;
    };

    async function lookupVIN() {
        if (!vin.trim()) {
            setError("Please enter a VIN");
            return;
        }

        const cleanedVin = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");

        if (!validateVIN(cleanedVin)) {
            setError("Invalid VIN format. VIN must be 17 characters (no I, O, or Q)");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/vin-lookup?vin=${encodeURIComponent(cleanedVin)}`, {
                headers: {
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to lookup VIN");
            }

            const { data } = await response.json();

            const specs: VehicleSpec = {
                vin: data.vin,
                year: data.year,
                make: data.make,
                model: data.model,
                trim: data.trim,
                engine: data.engine,
                body_style: data.body_style,
                fuel_type: data.fuel_type,
                transmission: data.transmission,
                drivetrain: data.drivetrain,
                exterior_color: data.exterior_color,
                interior_color: data.interior_color
            };

            setVehicleSpec(specs);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to lookup VIN");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                                <Car className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">VIN Lookup & Carfax</h2>
                                <p className="text-xs text-gray-500">
                                    Enter VIN to auto-populate vehicle details
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

                    <div className="p-6 space-y-6">
                        {/* Error Alert */}
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* VIN Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Vehicle Identification Number (VIN)
                            </label>
                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={vin}
                                        onChange={(e) => {
                                            setVin(e.target.value.toUpperCase());
                                            setError(null);
                                            setVehicleSpec(null);
                                            setCarfaxReport(null);
                                        }}
                                        placeholder="Enter 17-character VIN"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent uppercase"
                                        maxLength={17}
                                    />
                                </div>
                                <button
                                    onClick={lookupVIN}
                                    disabled={loading}
                                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Looking up...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-4 h-4" />
                                            Lookup
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                VIN is usually located on the driver side dashboard or door jamb
                            </p>
                        </div>

                        {/* Vehicle Specs Result */}
                        {vehicleSpec && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    <p className="text-sm font-medium text-emerald-700">
                                        Vehicle Found: {vehicleSpec.year} {vehicleSpec.make} {vehicleSpec.model}
                                    </p>
                                </div>

                                {/* Vehicle Details Grid */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Car className="w-4 h-4" />
                                        Vehicle Specifications
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500">Year</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.year}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Make</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.make}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Model</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.model}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Trim</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.trim || "N/A"}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Engine</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.engine || "N/A"}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Body Style</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.body_style || "N/A"}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Fuel Type</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.fuel_type || "N/A"}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Transmission</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.transmission || "N/A"}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Drivetrain</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.drivetrain || "N/A"}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Exterior Color</label>
                                            <p className="text-sm font-medium text-gray-900">{vehicleSpec.exterior_color || "N/A"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Carfax Section */}
                                <div className="border border-gray-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-violet-600" />
                                            <h3 className="text-sm font-semibold text-gray-700">Carfax Vehicle History</h3>
                                        </div>
                                        <button
                                            onClick={() => window.open("https://www.carfax.com/", "_blank")}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Get Carfax Report
                                        </button>
                                    </div>

                                    {carfaxReport ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                                <p className="text-sm font-medium text-emerald-700">Clean Title - No Issues Found</p>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                                                    <p className="text-2xl font-bold text-gray-900">{carfaxReport.ownership_count}</p>
                                                    <p className="text-xs text-gray-500">Previous Owners</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                                                    <p className="text-2xl font-bold text-emerald-600">{carfaxReport.accident_count}</p>
                                                    <p className="text-xs text-gray-500">Accidents</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                                                    <p className="text-2xl font-bold text-emerald-600">{carfaxReport.service_records ? "Yes" : "No"}</p>
                                                    <p className="text-xs text-gray-500">Service Records</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500">Title Status:</span>
                                                <span className="font-medium text-gray-900">{carfaxReport.title_status}</span>
                                            </div>

                                            <a
                                                href={carfaxReport.report_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 w-full py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                View Full Carfax Report
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-gray-500 text-sm">
                                            <Info className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                                            Click &quot;Get Carfax Report&quot; to open CARFAX login page
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setVehicleSpec(null);
                                            setCarfaxReport(null);
                                            setVin("");
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Search Another
                                    </button>
                                    <button
                                        onClick={() => {
                                            console.log("Use These Details clicked!", vehicleSpec);
                                            if (vehicleSpec) {
                                                onVinFound(vehicleSpec);
                                                onClose();
                                            }
                                        }}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                                    >
                                        Use These Details
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
