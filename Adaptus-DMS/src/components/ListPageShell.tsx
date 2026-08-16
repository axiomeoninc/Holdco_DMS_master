"use client";

// Shared list page composition: padding → PageHeader → MetricStrip → toolbar → body.
// Prefer MetricStrip for KPIs (decision-first); avoid equal StatCard grids.
// Breadcrumbs: TopHeader owns path crumbs; PageHeader crumbs stay opt-in.

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, type BreadcrumbItem } from "@/src/components/ui/PageHeader";
import { cn } from "@/src/lib/utils";

export interface ListPageShellProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    breadcrumbs?: BreadcrumbItem[];
    /**
     * Breadcrumb visibility. Default false — TopHeader owns path crumbs.
     * Pass true only for nested pages that need in-page back links.
     */
    showBreadcrumbs?: boolean;
    /** Header action buttons (refresh, export, primary CTA, view toggle, etc.). */
    actions?: ReactNode;
    /** Optional meta row under the title (counts, filters applied). */
    meta?: ReactNode;
    /** KPI strip — prefer MetricStrip over equal StatCard grids. */
    kpis?: ReactNode;
    /** Sticky filter / search toolbar. */
    toolbar?: ReactNode;
    /** Main content: table, kanban, or EmptyState. */
    children: ReactNode;
    className?: string;
}

export function ListPageShell({
    title,
    description,
    icon,
    breadcrumbs,
    showBreadcrumbs = false,
    actions,
    meta,
    kpis,
    toolbar,
    children,
    className,
}: ListPageShellProps) {
    return (
        <div
            className={cn(
                "animate-fade-in flex flex-col px-[var(--space-page-x)] py-[var(--space-page-y)] sm:px-6",
                className
            )}
            style={{ gap: "var(--space-section)" }}
        >
            <PageHeader
                title={title}
                description={description}
                icon={icon}
                breadcrumbs={showBreadcrumbs ? breadcrumbs : undefined}
                actions={actions}
                meta={meta}
            />
            {kpis || toolbar ? (
                <div className="rounded-lg border border-border bg-card">
                    {kpis ? (
                        <div
                            className={cn(
                                "min-w-0",
                                toolbar ? "border-b border-border" : undefined
                            )}
                        >
                            {kpis}
                        </div>
                    ) : null}
                    {toolbar}
                </div>
            ) : null}
            {children}
        </div>
    );
}
