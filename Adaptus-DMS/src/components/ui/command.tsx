"use client";

// Thin cmdk wrappers for the command palette.

import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/src/lib/utils";

export function Command({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            className={cn(
                "flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-foreground",
                className
            )}
            {...props}
        />
    );
}

export function CommandInput({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
    return (
        <div className="flex items-center gap-2 border-b border-border px-3" cmdk-input-wrapper="">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <CommandPrimitive.Input
                className={cn(
                    "flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
        </div>
    );
}

export function CommandList({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            className={cn("max-h-[min(420px,55vh)] overflow-y-auto overflow-x-hidden p-2", className)}
            {...props}
        />
    );
}

export function CommandEmpty({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export function CommandGroup({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            className={cn(
                "mb-2 overflow-hidden text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground",
                className
            )}
            {...props}
        />
    );
}

export function CommandItem({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            className={cn(
                "relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none",
                "data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary",
                "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                className
            )}
            {...props}
        />
    );
}

export function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn("ml-auto text-[10px] tracking-widest text-muted-foreground", className)}
            {...props}
        />
    );
}

export function CommandSeparator({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            className={cn("-mx-1 my-1 h-px bg-border", className)}
            {...props}
        />
    );
}
