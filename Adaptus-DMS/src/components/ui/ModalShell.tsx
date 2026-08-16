"use client";

// Standardized modal shell with Motion enter/exit (backdrop fade + panel scale).

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/src/lib/utils";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

export interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    /** Footer slot (typically a save button on the right). */
    footer?: ReactNode;
    /** Optional error to display at the top. */
    error?: string | null;
    /** Max width preset. */
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
    /** When true, clicking the backdrop does NOT close. */
    persistent?: boolean;
    /** Hide the default close X button (useful for fullscreen modals). */
    hideCloseButton?: boolean;
    /** Optional icon to show next to the title. */
    titleIcon?: ReactNode;
    /** Optional badge or extra content next to the title. */
    titleExtra?: ReactNode;
}

const SIZE_CLASSES = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
};

export function ModalShell({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    error,
    size = "lg",
    persistent = false,
    hideCloseButton = false,
    titleIcon,
    titleExtra,
}: ModalShellProps) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const lastFocusRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    useOverlayDismiss(onClose, { open, persistent });

    // Body scroll lock + focus management
    useEffect(() => {
        if (!open) return;
        lastFocusRef.current = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const t = setTimeout(() => {
            const focusable = dialogRef.current?.querySelector<HTMLElement>(
                'input, select, textarea, button:not([data-modal-close]), [href], [tabindex]:not([tabindex="-1"])'
            );
            focusable?.focus();
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
            if (e.key !== "Tab" || !dialogRef.current) return;
            const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
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

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    key="modal-shell"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={description ? descriptionId : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                >
                    <motion.div
                        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
                        aria-hidden
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        onClick={() => !persistent && onClose()}
                    />

                    <motion.div
                        ref={dialogRef}
                        className={cn(
                            "relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg",
                            "max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)]",
                            SIZE_CLASSES[size]
                        )}
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 4 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
                            {titleIcon && (
                                <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                                    {titleIcon}
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <h2 id={titleId} className="truncate text-h3 text-foreground">
                                    {title}
                                </h2>
                                {description && (
                                    <p id={descriptionId} className="mt-1 truncate text-sm text-muted-foreground">
                                        {description}
                                    </p>
                                )}
                            </div>
                            {titleExtra}
                            {!hideCloseButton && (
                                <Button
                                    data-modal-close
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    aria-label="Close dialog"
                                    className="h-10 w-10 shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="border-b border-destructive/20 bg-destructive-50 px-6 py-3.5 text-sm text-destructive"
                            >
                                {error}
                            </div>
                        )}

                        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>

                        {footer && (
                            <div className="flex min-h-12 items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
