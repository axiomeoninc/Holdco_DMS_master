"use client";

// Attio-style property list: label left / value right, hairline dividers.
// No gray tile cards.

import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export interface PropertyRowProps {
    label: string;
    children: ReactNode;
    className?: string;
    /** Stack label above value (long text). */
    stacked?: boolean;
}

export function PropertyRow({ label, children, className, stacked = false }: PropertyRowProps) {
    return (
        <div
            className={cn(
                "border-b border-border/70 py-2.5 last:border-b-0",
                stacked
                    ? "flex flex-col gap-1"
                    : "flex items-start justify-between gap-4",
                className
            )}
        >
            <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    "text-[13px] text-foreground",
                    stacked ? "w-full" : "min-w-0 text-right font-medium"
                )}
            >
                {children}
            </dd>
        </div>
    );
}

export interface PropertyListProps {
    children: ReactNode;
    className?: string;
    title?: string;
}

export function PropertyList({ children, className, title }: PropertyListProps) {
    return (
        <section className={cn("min-w-0", className)}>
            {title && (
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                </h3>
            )}
            <dl className="divide-y-0">{children}</dl>
        </section>
    );
}

/** Prose notes block — not a gray tile farm. */
export function RecordNotes({
    title = "Notes",
    children,
    className,
}: {
    title?: string;
    children: ReactNode;
    className?: string;
}) {
    if (!children) return null;
    return (
        <section className={cn("min-w-0", className)}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {children}
            </div>
        </section>
    );
}

/** Honest empty / missing value — never invent placeholder identities. */
export function PropertyEmpty({ label = "—" }: { label?: string }) {
    return <span className="font-normal text-muted-foreground">{label}</span>;
}
