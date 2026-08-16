// lib/fetch.ts
// F-02 + F-09 of v3 master plan. Centralized fetch wrapper for the browser.
//
// What it does:
//   1. Always sends `credentials: "include"` so the HttpOnly cookies
//      carrying the Supabase session are sent with every request.
//   2. Parses JSON safely.
//   3. On a 401, dispatches an "api-error" CustomEvent that the
//      ApiErrorBridge component picks up to redirect to /login (one
//      redirect per session, debounced, no toast spam).
//   4. On a 4xx/5xx, throws an ApiError. The bridge also surfaces
//      a toast for 5xx.
//
// Server-side code (route handlers, server components) does NOT use this
// wrapper; it uses `getCurrentUser()` and returns 401/403 directly.

import { toast } from "./toast";
import {
    DEALERSHIP_HEADER,
    readDealershipCookieFromDocument,
} from "./platform-rooftop";

interface ApiFetchOptions extends Omit<RequestInit, "body" | "credentials"> {
    body?: unknown;
    /** When true, suppress the auto-redirect on 401. */
    noAutoRedirect?: boolean;
    /** When true, suppress toast.error on 4xx. */
    silent?: boolean;
    /** When true, suppress toast.error on 5xx. */
    silent5xx?: boolean;
}

export class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(status: number, message: string, data: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

function dispatchApiError(detail: {
    status: number;
    url: string;
    message?: string;
    code?: string;
}) {
    if (typeof window === "undefined") return;
    try {
        window.dispatchEvent(new CustomEvent("api-error", { detail }));
    } catch {
        // ignore
    }
}

export async function apiFetch<T = unknown>(
    input: string,
    options: ApiFetchOptions = {}
): Promise<T> {
    const { body, noAutoRedirect, silent, silent5xx, headers, ...rest } = options;

    const rooftop = readDealershipCookieFromDocument();
    const init: RequestInit = {
        credentials: "include",
        ...rest,
        headers: {
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(rooftop ? { [DEALERSHIP_HEADER]: rooftop } : {}),
            ...(headers || {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    let res: Response;
    try {
        res = await fetch(input, init);
    } catch (err: unknown) {
        if (!silent) toast.error("Network error", "Check your connection.");
        throw new ApiError(0, err instanceof Error ? err.message : "Network error", null);
    }

    // 204 No Content
    if (res.status === 204) {
        return undefined as T;
    }

    let data: unknown = null;
    const text = await res.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        const dataObj =
            data && typeof data === "object" ? (data as Record<string, unknown>) : null;
        const rawMessage =
            dataObj && typeof dataObj.error === "string"
                ? dataObj.error
                : dataObj && typeof dataObj.message === "string"
                  ? dataObj.message
                  : null;
        const message = rawMessage || `Request failed (${res.status})`;
        const code =
            dataObj && typeof dataObj.code === "string" ? dataObj.code : undefined;

        // 401 -> delegate redirect to the bridge (debounced)
        if (res.status === 401) {
            if (!noAutoRedirect) {
                dispatchApiError({ status: 401, url: input, message, code });
            }
            throw new ApiError(401, message, data);
        }

        // 5xx -> toast + throw
        if (res.status >= 500 && !silent && !silent5xx) {
            toast.error("Server error", message);
        }

        // 4xx (403, 402, 404, 422, etc) -> bridge unless caller opted silent
        if (
            res.status >= 400 &&
            res.status < 500 &&
            res.status !== 401 &&
            !silent
        ) {
            dispatchApiError({ status: res.status, url: input, message, code });
        }

        throw new ApiError(res.status, message, data);
    }

    return data as T;
}
