"use client";

// Quiet segmented filter chips — selected = muted fill + ring, never solid green pills.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    selected?: boolean;
    /** Optional count badge (tabular). */
    count?: number | string;
    children: ReactNode;
}

export function FilterChip({
    selected = false,
    count,
    children,
    className,
    type = "button",
    ...rest
}: FilterChipProps) {
    return (
        <button
            type={type}
            aria-pressed={selected}
            className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                "disabled:pointer-events-none disabled:opacity-50",
                selected
                    ? "border-border bg-muted text-foreground ring-1 ring-inset ring-foreground/10"
                    : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                className
            )}
            {...rest}
        >
            {children}
            {count != null && count !== "" ? (
                <span
                    className={cn(
                        "tabular-nums text-[11px]",
                        selected ? "text-muted-foreground" : "text-muted-foreground/80"
                    )}
                >
                    {count}
                </span>
            ) : null}
        </button>
    );
}

export interface FilterChipGroupProps {
    "aria-label"?: string;
    className?: string;
    children: ReactNode;
}

/** Horizontal group for status / facet filters. */
export function FilterChipGroup({
    "aria-label": ariaLabel = "Filters",
    className,
    children,
}: FilterChipGroupProps) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={cn(
                "inline-flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-md border border-border bg-card p-1",
                className
            )}
        >
            {children}
        </div>
    );
}

export interface SegmentedControlOption<T extends string = string> {
    value: T;
    label: string;
    icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
    value: T;
    onChange: (value: T) => void;
    options: SegmentedControlOption<T>[];
    "aria-label"?: string;
    className?: string;
    size?: "sm" | "md";
}

/** Quiet icon/label segment control (Table / Grid, etc.). */
export function SegmentedControl<T extends string = string>({
    value,
    onChange,
    options,
    "aria-label": ariaLabel = "View",
    className,
    size = "sm",
}: SegmentedControlProps<T>) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={cn(
                "inline-flex shrink-0 gap-0.5 rounded-md border border-border bg-card p-1",
                className
            )}
        >
            {options.map((opt) => {
                const selected = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            size === "sm"
                                ? "min-h-10 px-2.5 py-2 text-xs"
                                : "min-h-10 px-3 py-2 text-[13px]",
                            selected
                                ? "bg-muted text-foreground ring-1 ring-inset ring-foreground/10"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {opt.icon}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
