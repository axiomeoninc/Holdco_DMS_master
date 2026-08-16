// src/lib/toast.ts
// Centralized toast helpers. Replaces native `alert()` call sites and gives
// every action success/error feedback. Uses Sonner under the hood.
//
// Usage:
//   import { toast } from "@/src/lib/toast";
//   toast.success("Vehicle saved");
//   toast.error("Failed to delete customer");
//   toast.error("Save failed", { description: "The server rejected the payload." });
//   toast.promise(saveVehicle(), { loading: "Saving...", success: "Saved", error: "Save failed" });

import { toast as sonnerToast } from "sonner";

type ToastOptions = {
    description?: string;
    duration?: number;
};

export const toast = {
    success: (message: string, options?: ToastOptions | string) => {
        const opts = typeof options === "string" ? { description: options } : options;
        return sonnerToast.success(message, opts?.description ? { description: opts.description } : undefined);
    },
    error: (message: string, options?: ToastOptions | string) => {
        const opts = typeof options === "string" ? { description: options } : options;
        return sonnerToast.error(message, opts?.description ? { description: opts.description } : undefined);
    },
    info: (message: string, options?: ToastOptions | string) => {
        const opts = typeof options === "string" ? { description: options } : options;
        return sonnerToast.info(message, opts?.description ? { description: opts.description } : undefined);
    },
    warning: (message: string, options?: ToastOptions | string) => {
        const opts = typeof options === "string" ? { description: options } : options;
        return sonnerToast.warning(message, opts?.description ? { description: opts.description } : undefined);
    },
    promise: <T,>(
        promise: Promise<T>,
        messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: unknown) => string) }
    ): Promise<T> => sonnerToast.promise(promise, messages) as unknown as Promise<T>,
    message: (message: string) => sonnerToast(message),
};
