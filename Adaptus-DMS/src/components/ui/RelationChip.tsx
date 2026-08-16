"use client";

// Attio-style relation chip: avatar + name → related customer.
// Honest empty state when no customer_id — never invent "Unknown" / letter C.

import type { MouseEvent } from "react";
import { Avatar } from "@/src/components/ui/Avatar";
import { cn } from "@/src/lib/utils";

export interface RelationChipProps {
    customerId?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    /** Shown when there is no customer_id — e.g. "Unlinked" or "Cash". */
    emptyLabel?: string;
    onOpen?: (customerId: string) => void;
    className?: string;
}

export function RelationChip({
    customerId,
    name,
    avatarUrl,
    emptyLabel = "Unlinked",
    onOpen,
    className,
}: RelationChipProps) {
    if (!customerId) {
        return (
            <span
                className={cn(
                    "inline-flex max-w-full min-w-0 items-center truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground",
                    className
                )}
            >
                {emptyLabel}
            </span>
        );
    }

    const label = name?.trim() || emptyLabel;
    const hasRealName = Boolean(name?.trim());

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onOpen?.(customerId);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={!onOpen}
            className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !onOpen && "cursor-default",
                className
            )}
            title={hasRealName ? label : `${emptyLabel} (no name on file)`}
        >
            <Avatar src={avatarUrl} name={hasRealName ? label : null} size="xs" />
            <span
                className={cn(
                    "min-w-0 truncate text-[13px]",
                    hasRealName ? "font-medium text-foreground" : "text-muted-foreground"
                )}
            >
                {label}
            </span>
        </button>
    );
}
