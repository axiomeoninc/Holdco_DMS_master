"use client";

// TanStack Table headless layer for desk DataTable patterns —
// sort, filter, and column visibility without AG Grid.

import { useMemo, useState, type ReactNode } from "react";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    type Column,
    type ColumnDef,
    type OnChangeFn,
    type SortingState,
    type Table,
    type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/lib/utils";

export type {
    ColumnDef,
    SortingState,
    VisibilityState,
    Table,
};
export { flexRender };

export type UseDeskTableOptions<TData> = {
    data: TData[];
    columns: ColumnDef<TData, unknown>[];
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    columnVisibility?: VisibilityState;
    onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
    globalFilter?: string;
    onGlobalFilterChange?: OnChangeFn<string>;
    /** Server-driven sort (inventory API, etc.). */
    manualSorting?: boolean;
    /** Server-driven search/filter. */
    manualFiltering?: boolean;
    getRowId?: (originalRow: TData, index: number) => string;
    initialColumnVisibility?: VisibilityState;
};

export function useDeskTable<TData>({
    data,
    columns,
    sorting: sortingControlled,
    onSortingChange,
    columnVisibility: visibilityControlled,
    onColumnVisibilityChange,
    globalFilter: filterControlled,
    onGlobalFilterChange,
    manualSorting = false,
    manualFiltering = false,
    getRowId,
    initialColumnVisibility,
}: UseDeskTableOptions<TData>): Table<TData> {
    const [sortingUncontrolled, setSortingUncontrolled] = useState<SortingState>(
        []
    );
    const [visibilityUncontrolled, setVisibilityUncontrolled] =
        useState<VisibilityState>(initialColumnVisibility ?? {});
    const [filterUncontrolled, setFilterUncontrolled] = useState("");

    const sorting = sortingControlled ?? sortingUncontrolled;
    const columnVisibility = visibilityControlled ?? visibilityUncontrolled;
    const globalFilter = filterControlled ?? filterUncontrolled;

    // TanStack Table returns unstable function identities — expected with React Compiler.
    // eslint-disable-next-line react-hooks/incompatible-library -- headless table API
    return useReactTable({
        data,
        columns,
        defaultColumn: {
            minSize: 64,
            size: 140,
            maxSize: 280,
        },
        state: {
            sorting,
            columnVisibility,
            globalFilter,
        },
        onSortingChange: onSortingChange ?? setSortingUncontrolled,
        onColumnVisibilityChange:
            onColumnVisibilityChange ?? setVisibilityUncontrolled,
        onGlobalFilterChange: onGlobalFilterChange ?? setFilterUncontrolled,
        getCoreRowModel: getCoreRowModel(),
        ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
        ...(manualFiltering
            ? {}
            : { getFilteredRowModel: getFilteredRowModel() }),
        manualSorting,
        manualFiltering,
        getRowId,
    });
}

export function DeskTableSortHeader<TData>({
    column,
    title,
    align = "left",
    className,
}: {
    column: Column<TData, unknown>;
    title: string;
    align?: "left" | "right" | "center";
    className?: string;
}) {
    if (!column.getCanSort()) {
        return <span className={cn("block min-w-0 truncate", className)}>{title}</span>;
    }

    const sorted = column.getIsSorted();
    return (
        <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className={cn(
                "inline-flex w-full min-w-0 items-center gap-1 font-medium hover:text-foreground",
                align === "right" && "justify-end",
                align === "center" && "justify-center",
                align === "left" && "justify-start",
                sorted ? "text-foreground" : "text-muted-foreground",
                className
            )}
        >
            <span className="min-w-0 truncate">{title}</span>
            {sorted === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : sorted === "desc" ? (
                <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            )}
        </button>
    );
}

export function DeskTableColumnsMenu<TData>({
    table,
    className,
}: {
    table: Table<TData>;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const hideable = useMemo(
        () => table.getAllLeafColumns().filter((c) => c.getCanHide()),
        [table]
    );

    if (hideable.length === 0) return null;

    return (
        <div className={cn("relative", className)}>
            <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((v) => !v)}
            >
                <Columns3 className="h-4 w-4" />
                Columns
            </Button>
            {open ? (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default"
                        aria-label="Close columns menu"
                        onClick={() => setOpen(false)}
                    />
                    <div
                        role="menu"
                        className="absolute right-0 z-50 mt-1.5 min-w-[11rem] rounded-lg border border-border bg-card p-1.5 shadow-md"
                    >
                        {hideable.map((column) => {
                            const label =
                                typeof column.columnDef.header === "string"
                                    ? column.columnDef.header
                                    : column.id;
                            return (
                                <label
                                    key={column.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/60"
                                >
                                    <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-border"
                                        checked={column.getIsVisible()}
                                        onChange={column.getToggleVisibilityHandler()}
                                    />
                                    <span className="truncate">{label}</span>
                                </label>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </div>
    );
}

/** Resolve EmptyState kind for list pages (first-use / no-results / permission). */
export type ListEmptyKind = "first-use" | "no-results" | "permission";

export function resolveListEmptyKind(opts: {
    hasFilters: boolean;
    /** Explicit deny (403 / missing :read). */
    forbidden?: boolean;
    canRead?: boolean;
}): ListEmptyKind {
    if (opts.forbidden || opts.canRead === false) return "permission";
    if (opts.hasFilters) return "no-results";
    return "first-use";
}

export function sortingToServer(
    sorting: SortingState,
    fallbackId: string,
    fallbackDesc = true
): { sortBy: string; sortDir: "asc" | "desc" } {
    const first = sorting[0];
    if (!first) {
        return {
            sortBy: fallbackId,
            sortDir: fallbackDesc ? "desc" : "asc",
        };
    }
    return {
        sortBy: first.id,
        sortDir: first.desc ? "desc" : "asc",
    };
}

export function serverToSorting(
    sortBy: string,
    sortDir: "asc" | "desc"
): SortingState {
    return [{ id: sortBy, desc: sortDir === "desc" }];
}

export function renderHeaderCell<TData>(
    table: Table<TData>,
    headerId: string,
    fallback: ReactNode
): ReactNode {
    const header = table
        .getHeaderGroups()[0]
        ?.headers.find((h) => h.column.id === headerId);
    if (!header || header.isPlaceholder) return fallback;
    return flexRender(header.column.columnDef.header, header.getContext());
}
