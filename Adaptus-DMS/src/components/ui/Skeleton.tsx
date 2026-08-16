"use client";

// src/components/ui/Skeleton.tsx
// F-09 of v3 master plan. Shimmering placeholder for loading states.

import { cn } from "@/src/lib/utils";

export interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-shimmer rounded-md bg-muted",
                className
            )}
            style={style}
            aria-hidden
        />
    );
}

/** Convenience: row of skeleton text lines for list pages. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className="h-3"
                    // Last line shorter for natural look
                    style={{ width: i === lines - 1 ? "60%" : "100%" }}
                />
            ))}
        </div>
    );
}

/** Convenience: skeleton for a card with image + text. */
export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
            <Skeleton className="mb-3 h-32 w-full rounded-xl" />
            <SkeletonText lines={3} />
        </div>
    );
}

/** Convenience: skeleton for a table row. */
export function SkeletonTable({ rows = 5, cols = 4, className = "" }: { rows?: number; cols?: number; className?: string }) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton key={c} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}
