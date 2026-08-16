"use client";

// Five flavors of empty state: first-use, no-results, error, permission, cleared.
// First-use teaches the next action and ⌘K.

import Link from "next/link";
import {
    Inbox,
    SearchX,
    AlertCircle,
    Lock,
    ArchiveX,
    type LucideIcon,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/src/lib/utils";

type EmptyKind = "first-use" | "no-results" | "error" | "permission" | "cleared";

const DEFAULTS: Record<EmptyKind, { icon: LucideIcon; title: string; description: string }> = {
    "first-use": {
        icon: Inbox,
        title: "Nothing here yet",
        description: "Add the first record to get this list working.",
    },
    "no-results": {
        icon: SearchX,
        title: "No matches",
        description: "Try adjusting your filters or search terms.",
    },
    error: {
        icon: AlertCircle,
        title: "Something went wrong",
        description: "We couldn't load this. Please try again.",
    },
    permission: {
        icon: Lock,
        title: "You don't have access",
        description: "Ask your administrator for the right permissions.",
    },
    cleared: {
        icon: ArchiveX,
        title: "All clear",
        description: "Nothing matches the current view.",
    },
};

export interface EmptyStateAction {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
    variant?: "primary" | "premium" | "outline" | "secondary" | "ghost" | "destructive";
}

export interface EmptyStateProps {
    kind?: EmptyKind;
    icon?: LucideIcon;
    title?: string;
    description?: string;
    action?: EmptyStateAction;
    secondaryAction?: EmptyStateAction;
    /** Show ⌘K / Ctrl+K hint — on by default for first-use. */
    keyboardHint?: boolean;
    className?: string;
}

function shortcutLabel(): string {
    if (typeof navigator === "undefined") return "Ctrl+K";
    return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K";
}

export function EmptyState({
    kind = "first-use",
    icon: IconOverride,
    title,
    description,
    action,
    secondaryAction,
    keyboardHint,
    className = "",
}: EmptyStateProps) {
    const defaults = DEFAULTS[kind];
    const Icon = IconOverride ?? defaults.icon;
    const t = title ?? defaults.title;
    const d = description ?? defaults.description;
    const ActionIcon = action?.icon;
    const SecondaryIcon = secondaryAction?.icon;
    const showKbd = keyboardHint ?? kind === "first-use";

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center animate-fade-in",
                className
            )}
        >
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary">
                <Icon className="h-7 w-7" />
            </div>
            <h3 className="text-h3 text-foreground">{t}</h3>
            {d && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{d}</p>}
            {(action || secondaryAction) && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {action &&
                        (action.href ? (
                            <Button asChild variant={action.variant}>
                                <Link href={action.href}>
                                    {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
                                    {action.label}
                                </Link>
                            </Button>
                        ) : (
                            <Button onClick={action.onClick} variant={action.variant}>
                                {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
                                {action.label}
                            </Button>
                        ))}
                    {secondaryAction &&
                        (secondaryAction.href ? (
                            <Button variant={secondaryAction.variant ?? "outline"} asChild>
                                <Link href={secondaryAction.href}>
                                    {SecondaryIcon && <SecondaryIcon className="mr-2 h-4 w-4" />}
                                    {secondaryAction.label}
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                variant={secondaryAction.variant ?? "outline"}
                                onClick={secondaryAction.onClick}
                            >
                                {SecondaryIcon && <SecondaryIcon className="mr-2 h-4 w-4" />}
                                {secondaryAction.label}
                            </Button>
                        ))}
                </div>
            )}
            {showKbd ? (
                <p className="mt-4 text-xs text-muted-foreground">
                    Press{" "}
                    <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-medium text-foreground">
                        {shortcutLabel()}
                    </kbd>{" "}
                    to search the desk or start an action.
                </p>
            ) : null}
        </div>
    );
}
