"use client";

// Thin Sonner toaster — brand-aligned defaults for the app shell.

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
    return (
        <SonnerToaster
            position="top-right"
            richColors
            closeButton
            duration={5000}
            toastOptions={{
                classNames: {
                    toast: "border border-border bg-card text-foreground shadow-lg",
                    title: "text-sm font-medium",
                    description: "text-xs text-muted-foreground",
                },
            }}
        />
    );
}
