"use client";

// Quieter page header — type hierarchy over icon hero chrome.

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    breadcrumbs?: BreadcrumbItem[];
    actions?: ReactNode;
    /** Optional metadata row below the title (counts, last updated, etc.). */
    meta?: ReactNode;
    /** Hero variant — reserved for rare landing pages; still restrained. */
    hero?: boolean;
    /** Deprecated accent; kept for API compat — title stays solid. */
    gradientTitle?: boolean;
    className?: string;
}

/**
 * Page title block. Path breadcrumbs live in TopHeader;
 * only pass `breadcrumbs` when an in-page trail is explicitly needed.
 */

export function PageHeader({
    title,
    description,
    icon: Icon,
    breadcrumbs,
    actions,
    meta,
    hero = false,
    gradientTitle: _gradientTitle = false,
    className = "",
}: PageHeaderProps) {
    void _gradientTitle;

    if (hero) {
        return (
            <header
                className={cn(
                    "rounded-lg border border-border bg-card px-5 py-5 sm:px-6",
                    className
                )}
            >
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav
                        aria-label="Breadcrumb"
                        className="mb-3 flex min-w-0 items-center gap-1 overflow-hidden text-xs text-muted-foreground"
                    >
                        {breadcrumbs.map((c, i) => (
                            <span key={i} className="flex min-w-0 items-center gap-1">
                                {c.href ? (
                                    <Link
                                        href={c.href}
                                        className="truncate rounded px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {c.label}
                                    </Link>
                                ) : (
                                    <span className="truncate">{c.label}</span>
                                )}
                                {i < breadcrumbs.length - 1 && (
                                    <ChevronRight className="h-3 w-3" aria-hidden />
                                )}
                            </span>
                        ))}
                    </nav>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5">
                        {Icon && (
                            <div className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground sm:inline-flex">
                                <Icon className="h-3.5 w-3.5" aria-hidden />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-h2 text-foreground">{title}</h1>
                            {description && (
                                <p className="mt-0.5 max-w-2xl truncate text-sm text-muted-foreground">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                    {actions && (
                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                            {actions}
                        </div>
                    )}
                </div>

                {meta && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {meta}
                    </div>
                )}
            </header>
        );
    }

    return (
        <header className={cn("space-y-2", className)}>
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav
                    aria-label="Breadcrumb"
                    className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-muted-foreground"
                >
                    {breadcrumbs.map((c, i) => (
                        <span key={i} className="flex min-w-0 items-center gap-1">
                            {c.href ? (
                                <Link
                                    href={c.href}
                                    className="truncate rounded px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {c.label}
                                </Link>
                            ) : (
                                <span className="truncate">{c.label}</span>
                            )}
                            {i < breadcrumbs.length - 1 && (
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                        </span>
                    ))}
                </nav>
            )}

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                    {Icon && (
                        <div className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground sm:inline-flex">
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-h2 text-foreground">{title}</h1>
                        {description && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex min-h-9 flex-wrap items-center gap-2 sm:shrink-0">
                        {actions}
                    </div>
                )}
            </div>

            {meta && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {meta}
                </div>
            )}
        </header>
    );
}
