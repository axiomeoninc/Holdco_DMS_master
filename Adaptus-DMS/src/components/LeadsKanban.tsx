"use client";

import React, { useEffect, useState } from "react";
import {
    Eye,
    Edit,
    Trash2,
    Mail,
    Phone,
    Clock,
    PhoneCall,
    UserCheck,
    UserX,
    GripVertical,
    Car,
    Loader2,
    type LucideIcon,
} from "lucide-react";
import { toast } from "@/src/lib/toast";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Avatar } from "@/src/components/ui/Avatar";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { cn, timeAgo } from "@/src/lib/utils";
import { resolveLeadScore, temperatureClass } from "@/src/lib/business/lead-score";

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
    score?: number | null;
    temperature?: string | null;
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

interface LeadsKanbanProps {
    leads: Lead[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onLeadClick: (lead: Lead) => void;
    onLeadEdit: (lead: Lead) => void;
    onLeadDelete: (lead: Lead) => void;
    onAdd?: () => void;
    canWrite?: boolean;
}

interface Column {
    id: string;
    title: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
    iconColor: string;
    status: string;
}

const COLUMNS: Column[] = [
    {
        id: "not_started",
        title: "Not Started",
        icon: Clock,
        color: "text-muted-foreground",
        bgColor: "bg-muted/20",
        borderColor: "border-border",
        iconColor: "text-muted-foreground",
        status: "Not Started",
    },
    {
        id: "in_progress",
        title: "In Progress",
        icon: PhoneCall,
        color: "text-foreground",
        bgColor: "bg-card",
        borderColor: "border-border",
        iconColor: "text-primary",
        status: "In Progress",
    },
    {
        id: "qualified",
        title: "Qualified",
        icon: UserCheck,
        color: "text-success",
        bgColor: "bg-card",
        borderColor: "border-border",
        iconColor: "text-success",
        status: "Qualified",
    },
    {
        id: "closed",
        title: "Closed",
        icon: UserCheck,
        color: "text-muted-foreground",
        bgColor: "bg-card",
        borderColor: "border-border",
        iconColor: "text-muted-foreground",
        status: "Closed",
    },
    {
        id: "lost",
        title: "Lost",
        icon: UserX,
        color: "text-destructive",
        bgColor: "bg-card",
        borderColor: "border-border",
        iconColor: "text-destructive",
        status: "Lost",
    },
];

function sourceChipClass(_source: string): string {
    return "bg-muted text-subtle-foreground";
}

const LeadsKanban: React.FC<LeadsKanbanProps> = ({
    leads,
    loading,
    error,
    onRefresh,
    onLeadClick,
    onLeadEdit,
    onLeadDelete,
    onAdd,
    canWrite = false,
}) => {
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
    const [updating, setUpdating] = useState(false);
    const [optimisticLeads, setOptimisticLeads] = useState<Lead[]>(leads);

    useEffect(() => {
        setOptimisticLeads(leads);
    }, [leads]);

    const getLeadsByStatus = (status: string) =>
        optimisticLeads.filter((lead) => lead.status === status);

    const handleDragStart = (e: React.DragEvent, lead: Lead) => {
        setDraggedLead(lead);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    async function handleDrop(e: React.DragEvent, targetStatus: string) {
        e.preventDefault();

        if (!draggedLead || draggedLead.status === targetStatus) {
            setDraggedLead(null);
            return;
        }

        const updatedLead = { ...draggedLead, status: targetStatus };
        setOptimisticLeads((prev) =>
            prev.map((lead) => (lead.id === draggedLead.id ? updatedLead : lead))
        );
        setDraggedLead(null);
        setUpdating(true);

        try {
            const response = await fetch(`/api/leads/${draggedLead.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: targetStatus }),
            });

            if (!response.ok) {
                throw new Error("Failed to update lead status");
            }

            onRefresh();
        } catch (err) {
            console.error("Failed to update lead status:", err);
            setOptimisticLeads(leads);
            toast.error("Failed to update lead status. Please try again.");
        } finally {
            setUpdating(false);
        }
    }

    if (loading) {
        return (
            <div className="rounded-lg border border-border bg-card p-5">
                <SkeletonTable rows={6} cols={5} />
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                kind="error"
                title="Couldn't load leads"
                description={error}
                action={{ label: "Try again", onClick: onRefresh }}
            />
        );
    }

    return (
        <>
            <div className="hidden w-full overflow-x-auto pb-4 lg:block">
                <div className="grid min-w-[900px] grid-cols-5 gap-3">
                    {COLUMNS.map((column) => {
                        const columnLeads = getLeadsByStatus(column.status);
                        const ColumnIcon = column.icon;

                        return (
                            <div
                                key={column.id}
                                className={cn(
                                    "flex min-h-[400px] flex-col rounded-lg border p-2.5 transition-colors",
                                    column.bgColor,
                                    column.borderColor,
                                    updating && "opacity-70"
                                )}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, column.status)}
                            >
                                <div className="flex items-center justify-between px-1.5 py-1">
                                    <div className="flex items-center gap-1.5">
                                        <ColumnIcon size={14} className={column.iconColor} />
                                        <h3 className="text-[13px] font-semibold text-foreground">
                                            {column.title}
                                        </h3>
                                        <span
                                            className={cn(
                                                "rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                                                column.color
                                            )}
                                        >
                                            {columnLeads.length}
                                        </span>
                                    </div>
                                    {updating && (
                                        <Loader2 size={14} className="animate-spin text-primary" />
                                    )}
                                </div>

                                <div
                                    className="mt-2 flex-1 space-y-2 overflow-y-auto"
                                    style={{ maxHeight: "calc(100vh - 300px)" }}
                                >
                                    {columnLeads.length === 0 ? (
                                        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center">
                                            <p className="text-[12px] text-muted-foreground">
                                                No leads here
                                            </p>
                                            {canWrite && onAdd && column.status === "Not Started" ? (
                                                <button
                                                    type="button"
                                                    onClick={onAdd}
                                                    className="mt-2 text-[12px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    Add lead
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {columnLeads.map((lead) => {
                                        const scored = resolveLeadScore(lead);
                                        return (
                                            <div
                                                key={lead.id}
                                                draggable={!updating}
                                                onDragStart={(e) => handleDragStart(e, lead)}
                                                className="cursor-grab rounded-md border border-border bg-card transition-colors hover:border-foreground/20 active:cursor-grabbing"
                                            >
                                                <div className="p-2.5">
                                                    <div className="mb-1.5 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <GripVertical size={12} />
                                                            <span
                                                                className={cn(
                                                                    "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                                                                    temperatureClass(scored.temperature)
                                                                )}
                                                                title={`Score ${scored.score}`}
                                                            >
                                                                {scored.temperature} · {scored.score}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [[draggable]:hover_&]:opacity-100 hover:opacity-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => onLeadClick(lead)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                title="View Details"
                                                                aria-label="View"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => onLeadEdit(lead)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                title="Edit"
                                                                aria-label="Edit"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => onLeadDelete(lead)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive-50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                title="Delete"
                                                                aria-label="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="mb-1.5 flex items-center gap-2">
                                                        <Avatar
                                                            name={lead.customer?.name}
                                                            src={lead.customer?.avatar}
                                                            size="sm"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="truncate text-[13px] font-semibold text-foreground">
                                                                {lead.customer?.name || "Unknown Customer"}
                                                            </h4>
                                                            <span
                                                                className={cn(
                                                                    "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                                                                    sourceChipClass(lead.source)
                                                                )}
                                                            >
                                                                {lead.source}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mb-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                                                        {lead.customer?.phone ? (
                                                            <div className="flex items-center gap-1">
                                                                <Phone size={10} className="shrink-0" />
                                                                <span className="truncate">
                                                                    {lead.customer.phone}
                                                                </span>
                                                            </div>
                                                        ) : lead.customer?.email ? (
                                                            <div className="flex items-center gap-1">
                                                                <Mail size={10} className="shrink-0" />
                                                                <span className="truncate">
                                                                    {lead.customer.email}
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    {lead.vehicle && (
                                                        <div className="mt-1.5 flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
                                                            <Car size={11} className="shrink-0 text-muted-foreground" />
                                                            <span className="truncate text-[11px] text-foreground">
                                                                {lead.vehicle.year} {lead.vehicle.make}{" "}
                                                                {lead.vehicle.model}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
                                                        <span className="truncate text-[11px] text-muted-foreground">
                                                            Next: {lead.assigned_user?.full_name || "Assign owner"}
                                                        </span>
                                                        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                                                            {timeAgo(lead.last_engagement)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-4 lg:hidden">
                {COLUMNS.map((column) => {
                    const columnLeads = getLeadsByStatus(column.status);
                    const ColumnIcon = column.icon;

                    return (
                        <div
                            key={column.id}
                            className="overflow-hidden rounded-xl border border-border bg-card"
                        >
                            <div
                                className={cn(
                                    "flex items-center gap-2 border-b px-4 py-3",
                                    column.bgColor,
                                    column.borderColor
                                )}
                            >
                                <ColumnIcon size={18} className={column.iconColor} />
                                <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
                                <span
                                    className={cn(
                                        "rounded-full bg-card px-2 py-0.5 text-xs font-medium",
                                        column.color
                                    )}
                                >
                                    {columnLeads.length}
                                </span>
                            </div>
                            {columnLeads.length === 0 ? (
                                <EmptyState
                                    kind="cleared"
                                    icon={ColumnIcon}
                                    title="Empty stage"
                                    description="No leads in this stage."
                                    className="m-3 border-0 bg-transparent py-8"
                                />
                            ) : (
                                <div className="divide-y divide-border">
                                    {columnLeads.map((lead) => {
                                        const scored = resolveLeadScore(lead);
                                        return (
                                            <div key={lead.id} className="p-4 transition-colors hover:bg-muted/40">
                                                <div className="mb-2 flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={lead.customer?.name}
                                                            src={lead.customer?.avatar}
                                                            size="sm"
                                                        />
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-foreground">
                                                                {lead.customer?.name || "Unknown Customer"}
                                                            </h4>
                                                            <div className="mt-0.5 flex flex-wrap gap-1">
                                                                <span
                                                                    className={cn(
                                                                        "rounded-full px-2 py-0.5 text-xs font-medium",
                                                                        sourceChipClass(lead.source)
                                                                    )}
                                                                >
                                                                    {lead.source}
                                                                </span>
                                                                <span
                                                                    className={cn(
                                                                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                                                                        temperatureClass(scored.temperature)
                                                                    )}
                                                                >
                                                                    {scored.temperature}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => onLeadClick(lead)}
                                                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onLeadEdit(lead)}
                                                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {lead.vehicle && (
                                                    <div className="mb-1 text-xs text-muted-foreground">
                                                        <Car size={12} className="mr-1 inline text-primary" />
                                                        {lead.vehicle.year} {lead.vehicle.make}{" "}
                                                        {lead.vehicle.model}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>{lead.assigned_user?.full_name || "Unassigned"}</span>
                                                    <span>{timeAgo(lead.last_engagement)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
};

export default LeadsKanban;
