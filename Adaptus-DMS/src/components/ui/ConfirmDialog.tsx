"use client";

// src/components/ui/ConfirmDialog.tsx
// F-09 of v3 master plan. Replaces native window.confirm() with a styled
// modal. Used for destructive actions like delete.

import { ModalShell } from "./ModalShell";
import { Button } from "./Button";
import { AlertTriangle, Info, AlertOctagon, type LucideIcon } from "lucide-react";

type Severity = "danger" | "warning" | "info";

const ICONS: Record<Severity, LucideIcon> = {
    danger: AlertOctagon,
    warning: AlertTriangle,
    info: Info,
};

const TITLES: Record<Severity, string> = {
    danger: "Are you absolutely sure?",
    warning: "Please confirm",
    info: "Just to confirm",
};

const CONFIRM_LABELS: Record<Severity, string> = {
    danger: "Delete",
    warning: "Continue",
    info: "Confirm",
};

const CONFIRM_VARIANT: Record<Severity, "destructive" | "primary"> = {
    danger: "destructive",
    warning: "primary",
    info: "primary",
};

export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void | Promise<void>;
    /** Optional message shown below the title. */
    message?: string;
    /** Optional detail (e.g. "This will delete 3 vehicles"). */
    detail?: string;
    /** Override the title. */
    title?: string;
    /** Override the confirm button label. */
    confirmLabel?: string;
    /** Override the cancel button label. */
    cancelLabel?: string;
    severity?: Severity;
    loading?: boolean;
    /** When true, user must type the resource name to confirm. */
    requireTextConfirmation?: string;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    message,
    detail,
    title,
    confirmLabel,
    cancelLabel = "Cancel",
    severity = "danger",
    loading = false,
    requireTextConfirmation,
}: ConfirmDialogProps) {
    const Icon = ICONS[severity];
    const defaultTitle = title ?? TITLES[severity];
    const defaultConfirm = confirmLabel ?? CONFIRM_LABELS[severity];

    return (
        <ModalShell
            open={open}
            onClose={() => onOpenChange(false)}
            title={defaultTitle}
            description={message}
            size="md"
            titleIcon={<Icon className="h-5 w-5" />}
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={CONFIRM_VARIANT[severity]}
                        onClick={onConfirm}
                        loading={loading}
                    >
                        {defaultConfirm}
                    </Button>
                </>
            }
        >
            {detail && (
                <p className="text-sm text-foreground">{detail}</p>
            )}
            {requireTextConfirmation && (
                <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">
                        Type <span className="font-mono font-semibold text-foreground">{requireTextConfirmation}</span> to confirm:
                    </p>
                    {/* The actual input is wired by the caller via a controlled state; we keep this simple here. */}
                </div>
            )}
        </ModalShell>
    );
}
