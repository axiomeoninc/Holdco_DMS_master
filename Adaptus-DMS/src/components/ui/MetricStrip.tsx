"use client";

// Decision-first inline metrics — preferred over equal StatCard grids on list pages.

import type { ReactNode } from "react";
import { cn, formatCompact, formatCurrency } from "@/src/lib/utils";
import { Tooltip } from "@/src/components/ui/Tooltip";

export interface MetricStripItem {
    label: string;
    value: number | string;
    /** Optional delta vs previous period (percent). */
    delta?: number;
    hint?: string;
    /** Longer explanation on hover (falls back to hint). */
    tooltip?: string;
    format?: "number" | "currency" | "compact" | "raw";
    /** Soft semantic tint for the value (status meaning only). */
    tone?: "default" | "hot" | "warm" | "cold" | "success" | "warning" | "destructive";
    /** Optional click handler (e.g. Aging KPI → filtered inventory). */
    onClick?: () => void;
}

export interface MetricStripProps {
    items: MetricStripItem[];
    loading?: boolean;
    className?: string;
    /** Optional trailing slot (e.g. period selector). */
    trailing?: ReactNode;
}

function formatValue(
    value: number | string,
    format: MetricStripItem["format"] = "number"
): string {
    if (value == null || value === "") return "—";
    if (format === "raw") return String(value);
    if (typeof value !== "number") return String(value);
    if (format === "currency") return formatCurrency(value);
    if (format === "compact") return formatCompact(value);
    return new Intl.NumberFormat("en-US").format(value);
}

const TONE_VALUE: Record<NonNullable<MetricStripItem["tone"]>, string> = {
    default: "text-foreground",
    hot: "text-destructive",
    warm: "text-warning",
    cold: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
};

export function MetricStrip({ items, loading = false, className, trailing }: MetricStripProps) {
    return (
        <div
            className={cn(
                // Soft strip (no competing card border) — ListPageShell owns chrome with toolbar
                "flex min-w-0 flex-nowrap items-stretch gap-0 overflow-x-auto rounded-lg bg-muted/40",
                className
            )}
            role="group"
            aria-label="Key metrics"
        >
            {items.map((item, index) => {
                const tone = item.tone ?? "default";
                const clickable = Boolean(item.onClick) && !loading;
                const tip = item.tooltip;
                const inner = (
                    <>
                        <p className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                            {item.label}
                        </p>
                        {loading ? (
                            <div className="h-5 w-12 animate-shimmer rounded bg-muted" />
                        ) : (
                            <p
                                className={cn(
                                    "truncate text-base font-semibold tabular-nums tracking-tight",
                                    TONE_VALUE[tone]
                                )}
                            >
                                {formatValue(item.value, item.format)}
                            </p>
                        )}
                        {!loading && item.hint ? (
                            <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p>
                        ) : null}
                        {!loading && typeof item.delta === "number" ? (
                            <p
                                className={cn(
                                    "text-[11px] font-medium tabular-nums",
                                    item.delta >= 0 ? "text-success" : "text-destructive"
                                )}
                            >
                                {item.delta >= 0 ? "+" : ""}
                                {item.delta.toFixed(1)}%
                            </p>
                        ) : null}
                    </>
                );
                const cellClass = cn(
                    "flex min-w-[6.5rem] max-w-[12rem] flex-1 flex-col justify-center gap-0.5 overflow-hidden px-3 py-2",
                    index > 0 && "border-l border-border"
                );
                const node = clickable ? (
                    <button
                        key={`${item.label}-${index}`}
                        type="button"
                        onClick={item.onClick}
                        className={cn(
                            cellClass,
                            "text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        )}
                    >
                        {inner}
                    </button>
                ) : (
                    <div key={`${item.label}-${index}`} className={cellClass}>
                        {inner}
                    </div>
                );
                return tip ? (
                    <Tooltip
                        key={`${item.label}-${index}-tip`}
                        content={tip}
                        side="bottom"
                        wrapperClassName="flex min-w-0 max-w-[12rem] flex-1 overflow-hidden"
                    >
                        {node}
                    </Tooltip>
                ) : (
                    node
                );
            })}
            {trailing ? (
                <div className="ml-auto flex shrink-0 items-center border-l border-border px-3 py-2">
                    {trailing}
                </div>
            ) : null}
        </div>
    );
}
