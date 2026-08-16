// lib/server-token.ts
// Bearer-or-cookie client. Tries the legacy `Authorization: Bearer` header
// first, then falls back to the canonical Supabase session cookies.
//
// F-02: most existing API routes call this directly without going through
// `getCurrentUser`. To make them all cookie-aware without rewriting 50+
// route files, this function transparently uses cookies when no bearer
// token is supplied.
//
// Cookies are read from the request's `Cookie` header (sync) so this
// function can be called synchronously the same way the legacy version was.

import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export class MissingBearerError extends Error {
    constructor() {
        super("MISSING_BEARER_TOKEN");
        this.name = "MissingBearerError";
    }
}

/**
 * Parse the raw `Cookie` header into the `{name, value}[]` shape that
 * @supabase/ssr expects. Skips empty entries and trims whitespace.
 */
function parseCookieHeader(header: string | null): { name: string; value: string }[] {
    if (!header) return [];
    return header
        .split(/;\s*/)
        .filter(Boolean)
        .map((part) => {
            const eq = part.indexOf("=");
            if (eq < 0) return { name: part.trim(), value: "" };
            return {
                name: part.slice(0, eq).trim(),
                value: decodeURIComponent(part.slice(eq + 1).trim()),
            };
        });
}

export function createTokenClient(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = req.headers.get("authorization") || "";
    const hasBearer = /^Bearer\s+.+/i.test(authHeader);

    // Read cookies from the request header (sync) so this function
    // remains a drop-in replacement for the previous sync version.
    const cookieHeader = req.headers.get("cookie");
    const cookies = parseCookieHeader(cookieHeader);

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        global: hasBearer
            ? {
                headers: { Authorization: authHeader },
            }
            : undefined,

        cookies: {
            getAll() {
                return cookies;
            },
            setAll() {
                // No-op: we can't write cookies back in a sync function.
                // The proxy.ts middleware handles cookie refreshes on the
                // request side, and response cookies are set by route
                // handlers via the NextResponse cookies API.
            },
        },
    });
}
