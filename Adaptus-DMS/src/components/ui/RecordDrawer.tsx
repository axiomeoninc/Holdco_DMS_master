"use client";

// Right-side record inspection panel (Stripe / Attio / Linear pattern).
// Use for *Details* views. Keep ModalShell for confirm + short forms.

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/src/lib/utils";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

export interface RecordDrawerProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    /** Sticky header slot (typically RecordHeader). */
    header?: ReactNode;
    /** Optional action bar under the header. */
    actions?: ReactNode;
    /** Optional footer (secondary Close only — primary actions live in header). */
    footer?: ReactNode;
    /** Width preset (~480–560px). */
    size?: "md" | "lg";
    /** When true, backdrop click does not close. */
    persistent?: boolean;
    /** Accessible title id override. */
    labelledBy?: string;
    className?: string;
}

const SIZE_CLASSES = {
    md: "max-w-[480px]",
    lg: "max-w-[560px]",
};

export function RecordDrawer({
    open,
    onClose,
    children,
    header,
    actions,
    footer,
    size = "lg",
    persistent = false,
    labelledBy,
    className,
}: RecordDrawerProps) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const lastFocusRef = useRef<HTMLElement | null>(null);
    const autoTitleId = useId();
    const titleId = labelledBy ?? autoTitleId;

    useOverlayDismiss(onClose, { open, persistent });

    useEffect(() => {
        if (!open) return;
        lastFocusRef.current = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const t = setTimeout(() => {
            const focusable = panelRef.current?.querySelector<HTMLElement>(
                'button:not([data-drawer-close]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            (focusable ?? panelRef.current)?.focus();
        }, 50);

        return () => {
            clearTimeout(t);
            document.body.style.overflow = previousOverflow;
            lastFocusRef.current?.focus?.();
        };
    }, [open]);

    // Focus trap (Escape handled by useOverlayDismiss)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Tab" || !panelRef.current) return;
            const focusables = panelRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div
                className="absolute inset-0 animate-fade-in bg-foreground/25 backdrop-blur-[2px]"
                onClick={() => !persistent && onClose()}
                aria-hidden
            />

            <div
                ref={panelRef}
                tabIndex={-1}
                className={cn(
                    "relative flex h-full w-full flex-col border-l border-border bg-card text-card-foreground shadow-xl outline-none animate-drawer-in",
                    SIZE_CLASSES[size],
                    className
                )}
            >
                <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
                    <div className="flex items-start gap-3 px-6 py-5">
                        <div className="min-w-0 flex-1" id={labelledBy ? undefined : titleId}>
                            {header}
                        </div>
                        <Button
                            data-drawer-close
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            aria-label="Close"
                            className="h-10 w-10 shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {actions && (
                        <div className="flex min-h-10 flex-wrap items-center gap-2 border-t border-border/60 px-6 py-3">
                            {actions}
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>

                {footer && (
                    <div className="flex min-h-12 shrink-0 items-center border-t border-border bg-muted/20 px-6 py-3.5">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
