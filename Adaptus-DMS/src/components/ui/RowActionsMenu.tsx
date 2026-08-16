"use client";

// Progressive disclosure for secondary row actions — primary stays visible; rest in kebab.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface RowActionItem {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    tone?: "default" | "destructive";
    disabled?: boolean;
}

export interface RowActionsMenuProps {
    /** Always-visible primary control(s). */
    primary?: ReactNode;
    items: RowActionItem[];
    className?: string;
    align?: "left" | "right";
}

export function RowActionsMenu({
    primary,
    items,
    className,
    align = "right",
}: RowActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    if (items.length === 0 && !primary) return null;

    return (
        <div
            ref={rootRef}
            className={cn("relative flex items-center justify-end gap-0.5", className)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {primary}
            {items.length > 0 ? (
                <>
                    <button
                        type="button"
                        className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
                            "hover:bg-muted hover:text-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            "active:bg-muted/80",
                            open && "bg-muted text-foreground"
                        )}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-controls={menuId}
                        aria-label="More actions"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen((v) => !v);
                        }}
                    >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </button>
                    {open ? (
                        <div
                            id={menuId}
                            role="menu"
                            className={cn(
                                "absolute z-20 mt-1 min-w-[9.5rem] rounded-md border border-border bg-card py-1 shadow-sm",
                                "top-full",
                                align === "right" ? "right-0" : "left-0"
                            )}
                        >
                            {items.map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    role="menuitem"
                                    disabled={item.disabled}
                                    className={cn(
                                        "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]",
                                        "focus-visible:outline-none focus-visible:bg-muted",
                                        "disabled:pointer-events-none disabled:opacity-50",
                                        item.tone === "destructive"
                                            ? "text-destructive hover:bg-destructive-50"
                                            : "text-foreground hover:bg-muted"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpen(false);
                                        item.onClick();
                                    }}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
