"use client";

import {
    Eye,
    Edit,
    Trash2,
    Mail,
    Phone,
    GripVertical,
    Car,
    User,
} from "lucide-react";

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

interface SortableLeadCardProps {
    lead: Lead;
    onView: (lead: Lead) => void;
    onEdit: (lead: Lead) => void;
    onDelete: (lead: Lead) => void;
}

export default function SortableLeadCard({
    lead,
    onView,
    onEdit,
    onDelete
}: SortableLeadCardProps) {
    const getSourceColor = (source: string) => {
        const colors: Record<string, string> = {
            Website: "bg-purple-500/20 text-purple-300",
            Referral: "bg-green-500/20 text-green-300",
            Event: "bg-yellow-500/20 text-yellow-300",
            "Walk-in": "bg-blue-500/20 text-blue-300",
            Facebook: "bg-indigo-500/20 text-indigo-300",
            Craigslist: "bg-orange-500/20 text-orange-300",
            Kijiji: "bg-red-500/20 text-red-300",
            Phone: "bg-teal-500/20 text-teal-300"
        };
        return colors[source] || "bg-gray-500/20 text-gray-300";
    };

    return (
        <div className="bg-slate-800/90 rounded-lg shadow-lg border border-white/10 hover:shadow-xl transition-all hover:border-emerald-500/50">
            <div className="p-3">
                {/* Drag Handle & Actions */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-gray-400">
                        <GripVertical size={14} />
                        <span className="text-xs font-mono truncate max-w-[80px]">
                            #{lead.id.slice(0, 8)}
                        </span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => onView(lead)}
                            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                            title="View Details"
                        >
                            <Eye size={14} />
                        </button>
                        <button
                            onClick={() => onEdit(lead)}
                            className="p-1 text-gray-400 hover:text-emerald-400 transition-colors"
                            title="Edit"
                        >
                            <Edit size={14} />
                        </button>
                        <button
                            onClick={() => onDelete(lead)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="flex items-center gap-2 mb-2">
                    {lead.customer?.avatar ? (
                        <img
                            src={lead.customer.avatar}
                            alt={lead.customer.name || "Customer"}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg flex-shrink-0">
                            <User className="text-white" size={14} />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white text-sm truncate">
                            {lead.customer?.name || "Unknown Customer"}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className={`px-1.5 py-0.5 rounded ${getSourceColor(lead.source)}`}>
                                {lead.source}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="mb-2 text-xs">
                    {lead.customer?.email && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Mail size={10} className="text-gray-400 flex-shrink-0" />
                            <span className="text-gray-400 truncate">{lead.customer.email}</span>
                        </div>
                    )}
                    {lead.customer?.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Phone size={10} className="text-gray-400 flex-shrink-0" />
                            <span className="text-gray-400 truncate">{lead.customer.phone}</span>
                        </div>
                    )}
                </div>

                {/* Vehicle Interest */}
                {lead.vehicle && (
                    <div className="flex items-center gap-1 mt-2 px-2 py-1 bg-white/5 rounded-lg">
                        <Car size={12} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-xs text-gray-300 truncate">
                            {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                        </span>
                    </div>
                )}

                {/* Assigned To & Last Engagement */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span className="text-xs text-gray-400">
                        {lead.assigned_user?.full_name || "Unassigned"}
                    </span>
                    <span className="text-xs text-gray-500">
                        {new Date(lead.last_engagement).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </div>
    );
}