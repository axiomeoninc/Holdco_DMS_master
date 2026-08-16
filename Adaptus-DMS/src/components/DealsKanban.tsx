"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, GripVertical, Loader2, Plus } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { cn } from "@/src/lib/utils";
import { firstImageUrl } from "@/src/lib/vehicle-image";
import { isDealStagnant } from "@/src/lib/business/lead-score";
import { apiFetch } from "@/src/lib/fetch";

export interface DealKanbanItem {
    id: string;
    vehicle_id: string | null;
    customer_id: string | null;
    deal_status: string;
    sale_price: number;
    deal_date: string;
    created_at: string;
    updated_at?: string | null;
    vehicle: {
        id: string;
        year: number;
        make: string;
        model: string;
        image_gallery?: string[];
    } | null;
    customer: { id: string; name: string } | null;
    salesperson: { id: string; full_name: string } | null;
}

const DEAL_STAGES = ["Negotiation", "Down Payment", "Finance", "Paid Off", "Cancelled"] as const;

/** Map imported / legacy statuses into kanban columns (Hillz used "Closed"). */
export function kanbanColumnForStatus(status: string): (typeof DEAL_STAGES)[number] | null {
    switch (status) {
        case "Negotiation":
        case "Open":
        case "Pending":
            return "Negotiation";
        case "Down Payment":
            return "Down Payment";
        case "Finance":
            return "Finance";
        case "Paid Off":
        case "Closed":
            return "Paid Off";
        case "Cancelled":
        case "Lost":
            return "Cancelled";
        default:
            return null;
    }
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Negotiation: { bg: "bg-status-pending-50", text: "text-status-pending", border: "border-status-pending/30" },
    "Down Payment": { bg: "bg-status-new-50", text: "text-status-new", border: "border-status-new/30" },
    Finance: { bg: "bg-muted", text: "text-foreground", border: "border-border" },
    "Paid Off": { bg: "bg-status-won-50", text: "text-status-won", border: "border-status-won/30" },
    Closed: { bg: "bg-status-sold-50", text: "text-status-sold", border: "border-status-sold/30" },
    Cancelled: { bg: "bg-status-lost-50", text: "text-status-lost", border: "border-status-lost/30" },
    Lost: { bg: "bg-status-lost-50", text: "text-status-lost", border: "border-status-lost/30" },
    Open: { bg: "bg-status-pending-50", text: "text-status-pending", border: "border-status-pending/30" },
    Pending: { bg: "bg-status-pending-50", text: "text-status-pending", border: "border-status-pending/30" },
};

interface DealsKanbanProps {
    deals: DealKanbanItem[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onAdd?: () => void;
    canWrite?: boolean;
    formatCurrency: (n: number) => string;
    formatDate: (d: string | null | undefined) => string;
}

export default function DealsKanban({
    deals,
    loading,
    error,
    onRefresh,
    onAdd,
    canWrite = false,
    formatCurrency,
    formatDate,
}: DealsKanbanProps) {
    const router = useRouter();
    const [dragged, setDragged] = useState<DealKanbanItem | null>(null);
    const [updating, setUpdating] = useState(false);
    const [optimistic, setOptimistic] = useState<DealKanbanItem[]>(deals);
    const suppressClickRef = React.useRef(false);

    useEffect(() => {
        setOptimistic(deals);
    }, [deals]);

    const byStage = (stage: string) =>
        optimistic.filter((d) => kanbanColumnForStatus(d.deal_status) === stage);

    const orphans = optimistic.filter((d) => kanbanColumnForStatus(d.deal_status) === null);

    const handleDragStart = (e: React.DragEvent, deal: DealKanbanItem) => {
        suppressClickRef.current = false;
        setDragged(deal);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", deal.id);
    };

    const handleDragEnd = () => {
        // Drop often fires click afterward — suppress card navigation once.
        suppressClickRef.current = true;
        window.setTimeout(() => {
            suppressClickRef.current = false;
        }, 150);
        setDragged(null);
    };

    const openDeal = (dealId: string) => {
        if (suppressClickRef.current) return;
        router.push(`/deals/${dealId}`);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    async function handleDrop(e: React.DragEvent, targetStatus: string) {
        e.preventDefault();
        const current = dragged;
        if (!current) return;
        const fromCol = kanbanColumnForStatus(current.deal_status);
        if (fromCol === targetStatus && current.deal_status === targetStatus) {
            setDragged(null);
            return;
        }
        // Already in this column under a legacy alias (e.g. Closed → Paid Off)
        if (fromCol === targetStatus) {
            setDragged(null);
            return;
        }
        if (!canWrite) {
            toast.error("You do not have permission to move deals");
            setDragged(null);
            return;
        }

        const prev = optimistic;
        setOptimistic((list) =>
            list.map((d) =>
                d.id === current.id ? { ...d, deal_status: targetStatus } : d
            )
        );
        setDragged(null);
        setUpdating(true);

        try {
            await apiFetch(`/api/deals/${current.id}`, {
                method: "PATCH",
                body: { deal_status: targetStatus },
            });
            onRefresh();
        } catch (err) {
            setOptimistic(prev);
            toast.error(
                err instanceof Error ? err.message : "Failed to update deal stage"
            );
        } finally {
            setUpdating(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                kind="error"
                title="Couldn't load deals"
                description={error}
                action={{ label: "Try again", onClick: onRefresh }}
            />
        );
    }

    return (
        <>
            <div className="hidden w-full overflow-x-auto pb-4 lg:block">
                <div className="grid min-w-[900px] grid-cols-5 gap-3">
                    {DEAL_STAGES.map((stage) => {
                        const columnDeals = byStage(stage);
                        const colors = STATUS_COLORS[stage];
                        return (
                            <div
                                key={stage}
                                className={cn(
                                    "flex min-h-[400px] flex-col rounded-xl border-2 p-3 transition-colors",
                                    colors?.border,
                                    colors?.bg,
                                    updating && "opacity-70"
                                )}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage)}
                            >
                                <div className="mb-3 flex items-center justify-between px-1">
                                    <h3 className={cn("text-sm font-semibold", colors?.text)}>
                                        {stage}
                                    </h3>
                                    <span
                                        className={cn(
                                            "rounded-full px-2 py-0.5 text-xs font-medium",
                                            colors?.bg,
                                            colors?.text
                                        )}
                                    >
                                        {columnDeals.length}
                                    </span>
                                </div>
                                <div
                                    className="flex-1 space-y-2 overflow-y-auto"
                                    style={{ maxHeight: "calc(100vh - 300px)" }}
                                >
                                    {columnDeals.length === 0 ? (
                                        <div className="rounded-md border border-dashed border-border bg-card/50 px-3 py-6 text-center">
                                            <p className="text-xs text-muted-foreground">
                                                Drop deals here
                                            </p>
                                            {canWrite && onAdd && stage === "Negotiation" ? (
                                                <button
                                                    type="button"
                                                    onClick={onAdd}
                                                    className="mt-2 text-xs font-medium text-primary hover:underline"
                                                >
                                                    New deal
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {columnDeals.map((deal) => {
                                        const stagnant = isDealStagnant(deal);
                                        return (
                                            <div
                                                key={deal.id}
                                                draggable={canWrite && !updating}
                                                onDragStart={(e) => handleDragStart(e, deal)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => openDeal(deal.id)}
                                                className={cn(
                                                    "cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
                                                    stagnant && "ring-1 ring-amber-400/60",
                                                    dragged?.id === deal.id && "opacity-50"
                                                )}
                                            >
                                                <div className="mb-1.5 flex items-start gap-2">
                                                    {canWrite ? (
                                                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    ) : null}
                                                    {firstImageUrl(deal.vehicle?.image_gallery) ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={
                                                                firstImageUrl(
                                                                    deal.vehicle?.image_gallery
                                                                ) ?? ""
                                                            }
                                                            alt=""
                                                            className="h-10 w-10 rounded-md object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                                                            <Car className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium text-foreground">
                                                            {deal.vehicle
                                                                ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                                                : "Unknown vehicle"}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {deal.customer?.name ||
                                                                (deal.customer_id
                                                                    ? "Unlinked"
                                                                    : "Cash")}
                                                        </p>
                                                        {deal.deal_status !== stage ? (
                                                            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                                                                {deal.deal_status}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2 text-xs">
                                                    <span className="font-semibold text-success">
                                                        {formatCurrency(deal.sale_price)}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {formatDate(deal.deal_date)}
                                                    </span>
                                                </div>
                                                {stagnant ? (
                                                    <p className="mt-1 text-[10px] font-medium text-amber-700">
                                                        Stagnant &gt;7d
                                                    </p>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {orphans.length > 0 ? (
                    <p className="mt-3 text-xs text-amber-700">
                        {orphans.length} deal{orphans.length === 1 ? "" : "s"} with unknown
                        status not shown in columns — open from table view.
                    </p>
                ) : null}
            </div>

            {/* Mobile: stage list */}
            <div className="space-y-3 lg:hidden">
                {optimistic.length === 0 ? (
                    <EmptyState
                        kind="cleared"
                        title="No deals"
                        description="Create a deal to start the pipeline."
                        action={
                            canWrite && onAdd
                                ? { label: "New deal", onClick: onAdd, icon: Plus }
                                : undefined
                        }
                    />
                ) : (
                    optimistic.map((deal) => (
                        <button
                            key={deal.id}
                            type="button"
                            onClick={() => openDeal(deal.id)}
                            className="w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm"
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span
                                    className={cn(
                                        "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                        STATUS_COLORS[deal.deal_status]?.bg,
                                        STATUS_COLORS[deal.deal_status]?.text
                                    )}
                                >
                                    {deal.deal_status}
                                </span>
                                <span className="text-sm font-semibold text-success">
                                    {formatCurrency(deal.sale_price)}
                                </span>
                            </div>
                            <p className="text-sm font-medium">
                                {deal.vehicle
                                    ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                    : "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {deal.customer?.name || "Cash / unlinked"} ·{" "}
                                {deal.salesperson?.full_name || "Unassigned"}
                            </p>
                        </button>
                    ))
                )}
            </div>
        </>
    );
}
