"use client";

// Vertical activity timeline with dots for RecordDrawer.

import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export interface ActivityItem {
    id: string;
    title: string;
    description?: ReactNode;
    timestamp?: string | null;
    /** Optional leading icon instead of the default dot. */
    icon?: ReactNode;
}

export interface ActivityTimelineProps {
    items: ActivityItem[];
    title?: string;
    className?: string;
    emptyLabel?: string;
}

export function ActivityTimeline({
    items,
    title = "Activity",
    className,
    emptyLabel = "No activity yet",
}: ActivityTimelineProps) {
    return (
        <section className={cn("min-w-0", className)}>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
                <ol className="relative space-y-0">
                    {items.map((item, index) => {
                        const isLast = index === items.length - 1;
                        return (
                            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                                {!isLast && (
                                    <span
                                        className="absolute left-[7px] top-3 bottom-0 w-px bg-border"
                                        aria-hidden
                                    />
                                )}
                                <span
                                    className={cn(
                                        "relative z-[1] mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center",
                                        item.icon
                                            ? "h-5 w-5 text-muted-foreground"
                                            : "rounded-full border-2 border-border bg-card"
                                    )}
                                    aria-hidden
                                >
                                    {item.icon ?? (
                                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    )}
                                </span>
                                <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="text-[13px] font-medium text-foreground">
                                            {item.title}
                                        </p>
                                        {item.timestamp && (
                                            <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                                {item.timestamp}
                                            </time>
                                        )}
                                    </div>
                                    {item.description && (
                                        <div className="mt-0.5 text-[13px] text-muted-foreground">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
