"use client";

// Sticky list toolbar: debounced search, filter selects, optional view toggle,
// export, and primary CTA. Navigation uses Link / router.push — never window.location.

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Download,
    LayoutGrid,
    List,
    Loader2,
    Plus,
    Search,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/src/components/ui/Button";
import { Select } from "@/src/components/ui/Select";
import { Tooltip } from "@/src/components/ui/Tooltip";
import { cn } from "@/src/lib/utils";
import { openCommandPalette } from "@/src/components/help/desk-help";

export type ListViewMode = "table" | "kanban";

export interface ListToolbarFilter {
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    /** Shown as the empty/all option label. */
    allLabel?: string;
    "aria-label"?: string;
}

export interface ListToolbarProps {
    searchPlaceholder?: string;
    searchValue: string;
    onSearchChange: (value: string) => void;
    filters?: ListToolbarFilter[];
    /** Extra controls (date pickers, more-filters popover, etc.). */
    extraFilters?: ReactNode;
    viewMode?: ListViewMode;
    onViewModeChange?: (mode: ListViewMode) => void;
    onExport?: () => void;
    exportLoading?: boolean;
    exportLabel?: string;
    /** Prefer href for primary CTA; onPrimaryClick wins when both are set. */
    primaryHref?: string;
    primaryLabel?: string;
    primaryIcon?: LucideIcon;
    onPrimaryClick?: () => void;
    showPrimary?: boolean;
    className?: string;
    children?: ReactNode;
}

export function ListToolbar({
    searchPlaceholder = "Search…",
    searchValue,
    onSearchChange,
    filters = [],
    extraFilters,
    viewMode,
    onViewModeChange,
    onExport,
    exportLoading = false,
    exportLabel = "Export",
    primaryHref,
    primaryLabel,
    primaryIcon: PrimaryIcon = Plus,
    onPrimaryClick,
    showPrimary = true,
    className,
    children,
}: ListToolbarProps) {
    const router = useRouter();

    const renderPrimary = () => {
        if (!showPrimary || !primaryLabel) return null;

        const label = (
            <>
                <PrimaryIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{primaryLabel}</span>
            </>
        );

                if (onPrimaryClick) {
            return (
                <Button
                    size="sm"
                    variant="premium"
                    onClick={() => {
                        onPrimaryClick();
                    }}
                >
                    {label}
                </Button>
            );
        }

        if (primaryHref) {
            return (
                <Button
                    size="sm"
                    variant="premium"
                    asChild
                >
                    <Link
                        href={primaryHref}
                        onClick={(e) => {
                            e.preventDefault();
                            router.push(primaryHref);
                        }}
                    >
                        {label}
                    </Link>
                </Button>
            );
        }

        return null;
    };

    return (
        <div
            className={cn(
                // Border/card chrome lives on ListPageShell when paired with MetricStrip
                "sticky top-0 z-10 min-w-0 bg-transparent px-3 py-2",
                className
            )}
        >
            <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="min-h-9 w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                        aria-label={searchPlaceholder}
                    />
                    <button
                        type="button"
                        onClick={() => openCommandPalette()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                        aria-label="Open command palette"
                    >
                        <span className="sm:hidden">Search</span>
                        <span className="hidden sm:inline">⌘K</span>
                    </button>
                </div>
                <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
                    {filters.map((filter) => (
                        <Select
                            key={filter.id}
                            value={filter.value}
                            onChange={(e) => filter.onChange(e.target.value)}
                            aria-label={filter["aria-label"] ?? filter.allLabel ?? filter.id}
                            containerClassName="min-w-0 max-w-[11rem] shrink-0 space-y-0"
                            className="min-w-[8.5rem] max-w-[11rem] bg-background"
                            options={[
                                { value: "", label: filter.allLabel ?? "All" },
                                ...filter.options,
                            ]}
                        />
                    ))}
                    {extraFilters}
                    {onViewModeChange && viewMode != null && (
                        <div className="flex rounded-md bg-muted/60 p-0.5">
                            <Tooltip content="Table view">
                            <button
                                type="button"
                                onClick={() => onViewModeChange("table")}
                                className={cn(
                                    "inline-flex min-h-9 items-center justify-center rounded-md p-2 transition-colors duration-150",
                                    viewMode === "table"
                                        ? "bg-card text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                                aria-label="Table view"
                                aria-pressed={viewMode === "table"}
                            >
                                <List className="h-4 w-4" />
                            </button>
                            </Tooltip>
                            <Tooltip content="Kanban view">
                            <button
                                type="button"
                                onClick={() => onViewModeChange("kanban")}
                                className={cn(
                                    "inline-flex min-h-9 items-center justify-center rounded-md p-2 transition-colors duration-150",
                                    viewMode === "kanban"
                                        ? "bg-card text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                                aria-label="Kanban view"
                                aria-pressed={viewMode === "kanban"}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                            </Tooltip>
                        </div>
                    )}
                    {onExport && (
                        <Tooltip content={exportLoading ? "Preparing export…" : exportLabel}>
                        <span className="inline-flex">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onExport}
                            disabled={exportLoading}
                        >
                            {exportLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">{exportLabel}</span>
                        </Button>
                        </span>
                        </Tooltip>
                    )}
                    {renderPrimary()}
                    {children}
                </div>
            </div>
        </div>
    );
}
