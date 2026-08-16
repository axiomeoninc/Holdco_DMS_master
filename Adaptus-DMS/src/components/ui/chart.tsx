"use client";

// Thin Recharts theme helpers — dashboard / reports reuse these tokens.

import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/src/lib/utils";

/** FlashFender chart palette (electric blue first). */
export const CHART_COLORS = [
    "hsl(var(--primary))",
    "#0EA5E9",
    "#6366F1",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#14B8A6",
] as const;

export const chartTooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
} as const;

export const chartAxisTick = {
    fontSize: 11,
    fill: "hsl(var(--muted-foreground))",
} as const;

export function ChartContainer({
    children,
    className,
    height = 200,
}: {
    children: ReactNode;
    className?: string;
    height?: number;
}) {
    return (
        <div className={cn("w-full", className)} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                {children as ReactElement}
            </ResponsiveContainer>
        </div>
    );
}
