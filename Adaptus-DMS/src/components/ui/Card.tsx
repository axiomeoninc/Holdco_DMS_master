"use client";

// src/components/ui/Card.tsx
// F-09 of v3 master plan. Card primitive with header, body, footer slots.

import type { HTMLAttributes, ReactNode } from "react";

const cn = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "rounded-lg border border-border bg-card text-card-foreground shadow-none",
                className
            )}
            {...rest}
        />
    );
}

export function CardHeader({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
    return (
        <div
            className={cn("flex items-start justify-between gap-3 border-b border-border px-5 py-4", className)}
            {...rest}
        >
            {children}
        </div>
    );
}

export function CardTitle({ className = "", children, ...rest }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) {
    return (
        <h3 className={cn("text-h3 text-foreground", className)} {...rest}>
            {children}
        </h3>
    );
}

export function CardDescription({ className = "", children, ...rest }: HTMLAttributes<HTMLParagraphElement> & { children?: ReactNode }) {
    return (
        <p className={cn("mt-0.5 text-sm text-muted-foreground", className)} {...rest}>
            {children}
        </p>
    );
}

export function CardContent({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5", className)} {...rest} />;
}

export function CardFooter({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3", className)}
            {...rest}
        />
    );
}
