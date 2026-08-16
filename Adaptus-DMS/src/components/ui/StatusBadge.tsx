"use client";

// src/components/ui/StatusBadge.tsx
// F-09 of v3 master plan. Centralized status pill with consistent color
// tokens for leads, deals, vehicles, tasks, tickets, invoices, etc.

import { cn } from "@/src/lib/utils";

type StatusKind = "neutral" | "info" | "success" | "warning" | "destructive" | "new" | "active" | "pending" | "sold" | "lost" | "won";

/* Semantic fills + stronger label color for chip contrast (AA) */
const KIND_CLASSES: Record<StatusKind, string> = {
    neutral: "bg-muted text-subtle-foreground ring-border",
    info: "bg-info-50 text-info ring-info/30",
    success: "bg-success-50 text-success ring-success/30",
    warning: "bg-warning-50 text-warning ring-warning/40",
    destructive: "bg-destructive-50 text-destructive ring-destructive/30",
    new: "bg-status-new-50 text-status-new ring-status-new/30",
    active: "bg-status-active-50 text-status-active ring-status-active/30",
    pending: "bg-status-pending-50 text-status-pending ring-status-pending/40",
    sold: "bg-status-sold-50 text-status-sold ring-status-sold/30",
    lost: "bg-status-lost-50 text-status-lost ring-status-lost/30",
    won: "bg-status-won-50 text-status-won ring-status-won/30",
};

/** Map free-form status strings to a kind. Customize per-resource as needed. */
export function statusToKind(status: string | null | undefined, resource: string = "default"): StatusKind {
    if (!status) return "neutral";
    const s = status.toLowerCase().trim();
    if (["active", "open", "available", "in stock"].includes(s)) return "active";
    if (["new", "not started", "fresh"].includes(s)) return "new";
    if (["pending", "in progress", "contacted", "qualified", "draft", "scheduled", "on hold", "waiting"].includes(s)) return "pending";
    if (["warning", "review", "attention"].includes(s)) return "warning";
    if (["info", "info only"].includes(s)) return "info";
    if (["sold", "closed-won", "closed won", "completed", "paid", "won", "converted", "delivered"].includes(s)) {
        // resource-specific overrides
        if (resource === "lead" && s === "won") return "won";
        if (resource === "deal" && (s === "closed won" || s === "won")) return "success";
        return "success";
    }
    if (["lost", "cancelled", "canceled", "expired", "failed", "no show", "no-show", "overdue"].includes(s)) return "destructive";
    if (["archived", "inactive", "disabled"].includes(s)) return "neutral";
    return "neutral";
}

export interface StatusBadgeProps {
    status: string | null | undefined;
    resource?: string;
    className?: string;
    /** Optional override if statusToKind doesn't give the right answer. */
    kind?: StatusKind;
    /** Show a small dot indicator before the label. */
    dot?: boolean;
}

export function StatusBadge({ status, resource = "default", className, kind, dot = true }: StatusBadgeProps) {
    if (!status) return null;
    const k = kind ?? statusToKind(status, resource);
    return (
        <span
            className={cn(
                "inline-flex max-w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                KIND_CLASSES[k],
                className
            )}
        >
            {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
            <span className="min-w-0 truncate">{status}</span>
        </span>
    );
}
