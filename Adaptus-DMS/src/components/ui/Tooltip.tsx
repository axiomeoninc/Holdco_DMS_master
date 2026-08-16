"use client";

// CSS tooltip — no Radix. Gold tokens, hairline, reduced-motion safe.

import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export type TooltipSide = "top" | "right" | "bottom" | "left";

const SIDE: Record<TooltipSide, string> = {
    top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
    right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
    bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
    left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
};

export interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    side?: TooltipSide;
    className?: string;
    /** Wrapper display. Use `block w-full` for collapsed nav icons. */
    wrapperClassName?: string;
}

export function Tooltip({
    content,
    children,
    side = "top",
    className,
    wrapperClassName,
}: TooltipProps) {
    if (content == null || content === "") {
        return <>{children}</>;
    }

    return (
        <span className={cn("relative group/tip min-w-0", wrapperClassName ?? "inline-flex")}>
            {children}
            <span
                role="tooltip"
                className={cn(
                    "pointer-events-none absolute z-[60] w-max max-w-[16rem] rounded-md border border-border bg-card px-2 py-1 text-left text-[11px] font-medium leading-snug text-foreground shadow-sm",
                    "invisible opacity-0 transition-opacity duration-150 delay-150",
                    "group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100",
                    "motion-reduce:transition-none motion-reduce:delay-0",
                    SIDE[side],
                    className
                )}
            >
                {content}
            </span>
        </span>
    );
}
