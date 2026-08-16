"use client";

// Thin @tanstack/react-virtual list for large inventory / table bodies.

import {
    useRef,
    type CSSProperties,
    type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/src/lib/utils";

export type VirtualListProps<T> = {
    items: T[];
    estimateSize: number;
    overscan?: number;
    className?: string;
    height?: number | string;
    getItemKey?: (item: T, index: number) => string | number;
    renderItem: (item: T, index: number) => ReactNode;
};

export function VirtualList<T>({
    items,
    estimateSize,
    overscan = 8,
    className,
    height = 560,
    getItemKey,
    renderItem,
}: VirtualListProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => estimateSize,
        overscan,
        getItemKey: getItemKey
            ? (index) => getItemKey(items[index] as T, index)
            : undefined,
    });

    const style: CSSProperties = {
        height: typeof height === "number" ? `${height}px` : height,
    };

    return (
        <div
            ref={parentRef}
            className={cn("overflow-auto", className)}
            style={style}
        >
            <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
                {virtualizer.getVirtualItems().map((row) => {
                    const item = items[row.index];
                    if (item === undefined) return null;
                    return (
                        <div
                            key={row.key}
                            data-index={row.index}
                            ref={virtualizer.measureElement}
                            className="absolute left-0 top-0 w-full"
                            style={{
                                transform: `translateY(${row.start}px)`,
                            }}
                        >
                            {renderItem(item, row.index)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
