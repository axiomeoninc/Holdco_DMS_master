"use client";

// src/components/ui/StatCard.tsx
// F-09 of v3 master plan. Prefer MetricStrip on dashboards and lists;
// keep this tile flat for remaining chart/story use.

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn, formatCompact, formatCurrency } from "@/src/lib/utils";

export interface StatCardProps {
    label: string;
    value: number | string;
    /** Optional delta vs previous period. Positive = green, negative = red. */
    delta?: number;
    deltaLabel?: string;
    icon?: LucideIcon;
    iconClassName?: string;
    format?: "number" | "currency" | "compact" | "raw";
    loading?: boolean;
    href?: string;
    className?: string;
}

export function StatCard({
    label,
    value,
    delta,
    deltaLabel,
    icon: Icon,
    iconClassName = "text-muted-foreground",
    format = "number",
    loading = false,
    href,
    className = "",
}: StatCardProps) {
    const display = (() => {
        if (loading || value == null || value === "") return "—";
        if (format === "raw") return String(value);
        if (typeof value !== "number") return String(value);
        if (format === "currency") return formatCurrency(value);
        if (format === "compact") return formatCompact(value);
        return new Intl.NumberFormat("en-US").format(value);
    })();

    const deltaPositive = typeof delta === "number" && delta >= 0;
    const CardTag = href ? "a" : "div";
    const hrefProps = href ? { href } : {};

    return (
        <CardTag
            {...hrefProps}
            className={cn(
                "flex min-w-0 flex-col gap-1 overflow-hidden rounded-md border border-border bg-card px-3 py-2.5 shadow-none",
                href &&
                    "transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                className
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-caption text-muted-foreground">{label}</p>
                {Icon && (
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} aria-hidden />
                )}
            </div>

            <div className="flex items-baseline gap-2">
                {loading ? (
                    <div className="h-6 w-16 animate-shimmer rounded bg-muted" />
                ) : (
                    <p className="min-w-0 truncate text-h2 text-foreground tabular-nums">{display}</p>
                )}
                {typeof delta === "number" && !loading && (
                    <span
                        className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                            deltaPositive ? "text-success" : "text-destructive"
                        )}
                    >
                        {deltaPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                        ) : (
                            <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(delta).toFixed(1)}%
                    </span>
                )}
            </div>

            {deltaLabel && !loading && (
                <p className="truncate text-[11px] text-muted-foreground">{deltaLabel}</p>
            )}
        </CardTag>
    );
}
