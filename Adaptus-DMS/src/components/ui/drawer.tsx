"use client";

// Thin Vaul drawer — mobile filters / sheets.
// Overlay fade via Motion; sheet slide stays with Vaul (avoids double transform).

import type { ComponentPropsWithoutRef } from "react";
import { motion } from "motion/react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/src/lib/utils";

export const Drawer = DrawerPrimitive.Root;
export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;
export const DrawerPortal = DrawerPrimitive.Portal;

export function DrawerOverlay({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>) {
    return (
        <DrawerPrimitive.Overlay asChild {...props}>
            <motion.div
                className={cn("fixed inset-0 z-[70] bg-foreground/40", className)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
            />
        </DrawerPrimitive.Overlay>
    );
}

export function DrawerContent({
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>) {
    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                className={cn(
                    "fixed inset-x-0 bottom-0 z-[70] mt-24 flex max-h-[85vh] flex-col rounded-t-xl border border-border bg-card outline-none",
                    className
                )}
                {...props}
            >
                <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted" aria-hidden />
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    );
}

export function DrawerHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
    return <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
}

export function DrawerTitle({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>) {
    return (
        <DrawerPrimitive.Title
            className={cn("text-base font-semibold text-foreground", className)}
            {...props}
        />
    );
}

export function DrawerDescription({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export function DrawerFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
    return <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}
