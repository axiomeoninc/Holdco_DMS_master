"use client";

// src/components/ui/Badge.tsx
// F-09 of v3 master plan. Generic inline label (non-status).

import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type Variant = "default" | "outline" | "subtle" | "info" | "success" | "warning" | "destructive";

/* Tones use darker semantic text for WCAG AA on tinted fills */
const VARIANT_CLASSES: Record<Variant, string> = {
    default: "bg-muted text-foreground",
    outline: "border border-border bg-transparent text-foreground",
    subtle: "bg-muted/60 text-subtle-foreground",
    info: "bg-info-50 text-info ring-1 ring-inset ring-info/25",
    success: "bg-success-50 text-success ring-1 ring-inset ring-success/25",
    warning: "bg-warning-50 text-warning ring-1 ring-inset ring-warning/35",
    destructive: "bg-destructive-50 text-destructive ring-1 ring-inset ring-destructive/25",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
}

export function Badge({ className = "", variant = "default", ...rest }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex max-w-full min-w-0 items-center truncate whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
                VARIANT_CLASSES[variant],
                className
            )}
            {...rest}
        />
    );
}
