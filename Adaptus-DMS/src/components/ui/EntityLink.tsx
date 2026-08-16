"use client";

// Brand Blue primary-cell link for dense lists (invoice #, deal #, etc.).
// Always stopPropagation so nested clicks don't also fire row onClick.

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export interface EntityLinkProps {
    children: ReactNode;
    className?: string;
    href?: string;
    onClick?: (e: MouseEvent<HTMLElement>) => void;
    title?: string;
}

export function EntityLink({
    children,
    className,
    href,
    onClick,
    title,
}: EntityLinkProps) {
    const classes = cn(
        "block min-w-0 truncate font-medium text-primary hover:underline underline-offset-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
        className
    );

    const handleClick = (e: MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        onClick?.(e);
    };

    if (href) {
        return (
            <Link href={href} className={classes} title={title} onClick={handleClick}>
                {children}
            </Link>
        );
    }

    return (
        <button type="button" className={cn(classes, "text-left")} title={title} onClick={handleClick}>
            {children}
        </button>
    );
}
