"use client";

// src/components/ApiErrorBridge.tsx
// F-09 of v3 master plan. Bridges window-level fetch events to the toast
// system, so direct `fetch()` calls (and 401 redirects) get consistent
// treatment. Most app code should prefer `apiFetch()` which already does
// this; this is a safety net for any forgotten direct fetch.

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/src/lib/toast";

/**
 * Mount once in the root layout. Listens for a custom "api-error" event
 * that the apiFetch wrapper dispatches on 4xx/5xx. On 401, redirects to
 * /login (once per session, debounced).
 */
export function ApiErrorBridge() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const onError = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const status = detail.status as number | undefined;
            const message = detail.message as string | undefined;
            const code = detail.code as string | undefined;

            if (status === 401) {
                // Avoid redirect loops / spamming
                if (typeof window === "undefined") return;
                if (window.sessionStorage.getItem("__auth_redirect_inflight")) return;
                window.sessionStorage.setItem("__auth_redirect_inflight", "1");

                const next = encodeURIComponent(pathname + window.location.search);
                toast.error("Session expired", "Please sign in again.");
                setTimeout(() => {
                    window.location.assign(new URL(`/login?next=${next}`, window.location.origin).href);
                    setTimeout(
                        () => window.sessionStorage.removeItem("__auth_redirect_inflight"),
                        2000
                    );
                }, 250);
                return;
            }

            // Soft-lock: trial ended — honest upgrade path, not a generic deny
            if (status === 402 || code === "TRIAL_EXPIRED") {
                toast.error(
                    "Trial ended",
                    message ||
                        "Your 7-day trial has ended. Contact AdaptUs to upgrade. Your data is retained."
                );
                return;
            }

            // Login/register verify flow handles this; avoid "Permission denied"
            if (code === "EMAIL_NOT_VERIFIED") {
                return;
            }

            if (status && status >= 500) {
                toast.error("Server error", message || "Something went wrong on our end.");
            } else if (status === 403) {
                toast.error("Permission denied", "You don't have access to that resource.");
            }
        };

        window.addEventListener("api-error", onError);
        return () => window.removeEventListener("api-error", onError);
    }, [pathname, router]);

    return null;
}
