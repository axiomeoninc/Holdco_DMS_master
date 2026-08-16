"use client";

// Shared hairline DataTable class helpers — sticky thead, 13px body, tabular nums, mono VIN.
// TanStack Table (sort / filter / column visibility) lives in desk-table.tsx and is re-exported here.

import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

export {
    useDeskTable,
    DeskTableSortHeader,
    DeskTableColumnsMenu,
    flexRender,
    resolveListEmptyKind,
    sortingToServer,
    serverToSorting,
} from "./desk-table";
export type {
    ColumnDef,
    SortingState,
    VisibilityState,
    Table as DeskTableInstance,
    ListEmptyKind,
} from "./desk-table";

/** Outer scroll + border shell for list tables. */
export const dataTableShellClass =
    "overflow-hidden rounded-lg border border-border bg-card";

/** Scroll region; pair with sticky thead. */
export const dataTableScrollClass =
    "max-h-[calc(100vh-14rem)] overflow-auto";

/** Root `<table>` — Stripe-density body type. Fixed layout so identity cells can truncate. */
export const dataTableClass = "table-fixed w-full min-w-0 text-[13px]";

/** Sticky header bar. */
export const dataTableTheadClass =
    "sticky top-0 z-[1] border-b border-border bg-card/95 backdrop-blur-sm";

/** Header row label style. */
export const dataTableHeaderRowClass =
    "text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground";

/** Header cell padding. */
export const dataTableThClass = "min-w-0 truncate px-3.5 py-2.5 font-semibold";

/** Body with hairline row dividers. */
export const dataTableTbodyClass = "divide-y divide-border";

/** Default data row. */
export const dataTableRowClass =
    "group transition-colors hover:bg-muted/30";

/** Default body cell — comfortable row pad; actions clear of text. */
export const dataTableTdClass = "min-w-0 overflow-hidden px-3.5 py-2.5 text-foreground";

/** Right-aligned numeric cell. */
export const dataTableTdNumClass =
    "min-w-0 whitespace-nowrap px-3.5 py-2.5 text-right tabular-nums text-foreground";

/** Muted secondary numeric (days, counts). */
export const dataTableTdMutedNumClass =
    "min-w-0 whitespace-nowrap px-3.5 py-2.5 text-right tabular-nums text-muted-foreground";

/** Mono VIN / ID line under primary identity. */
export const dataTableVinClass =
    "mt-0.5 min-w-0 truncate font-mono text-[11px] tracking-tight text-muted-foreground";

/** Primary identity line in the first column. */
export const dataTableIdentityClass =
    "min-w-0 truncate font-medium leading-tight text-foreground";

export function DataTableShell({
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn(dataTableShellClass, className)} {...rest} />;
}

export function DataTableScroll({
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn(dataTableScrollClass, className)} {...rest} />;
}

export function DataTable({
    className,
    ...rest
}: HTMLAttributes<HTMLTableElement>) {
    return <table className={cn(dataTableClass, className)} {...rest} />;
}

export function DataTableHead({
    className,
    ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn(dataTableTheadClass, className)} {...rest} />;
}

export function DataTableHeaderRow({
    className,
    ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
    return <tr className={cn(dataTableHeaderRowClass, className)} {...rest} />;
}

export function DataTableTh({
    className,
    ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
    return <th className={cn(dataTableThClass, className)} {...rest} />;
}

export function DataTableBody({
    className,
    ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn(dataTableTbodyClass, className)} {...rest} />;
}

export function DataTableRow({
    className,
    ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
    return <tr className={cn(dataTableRowClass, className)} {...rest} />;
}

/** Clickable dense-list row — Stripe affordance: pointer, muted hover, left accent, Enter. */
export interface ClickableDataTableRowProps
    extends HTMLAttributes<HTMLTableRowElement> {
    onRowClick?: () => void;
}

export function ClickableDataTableRow({
    onRowClick,
    className,
    onKeyDown,
    ...rest
}: ClickableDataTableRowProps) {
    return (
        <tr
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={cn(
                dataTableRowClass,
                onRowClick &&
                    "cursor-pointer border-l-2 border-l-transparent hover:border-l-primary hover:bg-muted/50 focus-visible:border-l-primary focus-visible:bg-muted/50 focus-visible:outline-none",
                className
            )}
            onClick={onRowClick}
            onKeyDown={(e) => {
                onKeyDown?.(e);
                if (e.defaultPrevented || !onRowClick) return;
                if (e.key === "Enter") {
                    e.preventDefault();
                    onRowClick();
                }
            }}
            {...rest}
        />
    );
}

/** Alias used by list pages — same as ClickableDataTableRow. */
export const ClickableDataTable = ClickableDataTableRow;

export function DataTableTd({
    className,
    ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
    return <td className={cn(dataTableTdClass, className)} {...rest} />;
}

export function DataTableTdNum({
    className,
    ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
    return <td className={cn(dataTableTdNumClass, className)} {...rest} />;
}
