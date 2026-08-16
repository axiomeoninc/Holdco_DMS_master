// src/middleware.ts
// F-02 auth: refresh the Supabase session cookies on every request.
//
// Why `middleware.ts` and not `proxy.ts`?
//   In Next.js 16, `proxy.ts` is the new convention but it is locked to the
//   Node.js runtime. `@opennextjs/cloudflare` v1.x does not yet support
//   Node middleware (opennextjs-cloudflare#962). The `middleware.ts` file
//   is still available for Edge runtime use cases; it is deprecated for new
//   code but it is the only path that works on Cloudflare Workers today.
//   When OpenNext adds Edge support for `proxy.ts` we will migrate.
//
// What this file does:
//   1. Build a Supabase server client wired to the request/response cookies.
//   2. Touch `getUser()` so @supabase/ssr reads the access token, refreshes
//      it if expired, and writes the new pair back to the response cookies.
//   3. For protected routes, redirect unauthenticated users to /login with
//      a `?next=` param so they can return to where they were.
//
// Public routes (login, register, /api/auth/*, static assets) are skipped so
// the redirect never loops. Legacy signup bookmarks redirect to register via
// next.config (no real page at the old path).
//
// We do NOT do any business-logic authorization here — that's the job of
// `getCurrentUser()` in each API route. This file only refreshes session.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
    applyCorsHeaders,
    corsPreflightResponse,
    getAllowlistedCorsOrigin,
    isApiPath,
} from "@/src/lib/cors";

const PUBLIC_PATHS = [
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/unsubscribe", // CASL preference centre — must stay public
    "/api/unsubscribe", // CASL preference write (token-gated)
    "/showroom", // hosted dealer microsite (public by design)
    "/review", // review-link landing page (public by design)
    "/embed", // public inventory embed (website widget + /embed/vehicles/:id)
    "/api/showroom", // public showroom lead capture
    "/api/auth", // all auth routes (login, register, otp, forgot/reset)
    "/api/health",
    "/api/webhooks",
    "/api/vehicles/public", // website embed inventory API
    "/_next",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
];

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublic(pathname: string): boolean {
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        return true;
    }
    // Static files: any path with an extension
    return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isMutatingApi(pathname: string, method: string): boolean {
    if (!pathname.startsWith("/api/")) return false;
    if (!WRITE_METHODS.has(method.toUpperCase())) return false;
    if (pathname.startsWith("/api/auth/")) return false;
    if (pathname.startsWith("/api/unsubscribe")) return false;
    if (pathname.startsWith("/api/webhooks")) return false;
    if (pathname.startsWith("/api/health")) return false;
    if (pathname.startsWith("/api/vehicles/public")) return false;
    if (pathname.startsWith("/api/showroom")) return false;
    // Allow Exit even when the impersonated dealership is trial soft-locked
    if (pathname === "/api/platform/impersonate/exit") return false;
    return true;
}

function isTrialSoftLockedRow(row: {
    subscription_status?: string | null;
    trial_ends_at?: string | null;
} | null): boolean {
    if (!row) return false;
    const status = row.subscription_status;
    if (!status || status === "active" || status === "canceled") return false;
    if (status === "expired") return true;
    if (status === "trialing" && row.trial_ends_at) {
        return new Date(row.trial_ends_at).getTime() <= Date.now();
    }
    return false;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const corsOrigin = isApiPath(pathname)
        ? getAllowlistedCorsOrigin(request)
        : null;

    // Expo web preflight — answer before auth so browsers can call /api/* cross-origin.
    if (
        corsOrigin &&
        request.method.toUpperCase() === "OPTIONS" &&
        isApiPath(pathname)
    ) {
        return corsPreflightResponse(corsOrigin);
    }

    // Always start with a pass-through response; we mutate cookies on it
    // before returning.
    let response = NextResponse.next({ request });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // Misconfigured — fail open so the app stays reachable, but log.
        console.error("[middleware] Missing Supabase env vars; skipping session refresh");
        return corsOrigin ? applyCorsHeaders(response, corsOrigin) : response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                // CRITICAL: write to BOTH the request cookies (so any code in
                // this request sees the new value) AND the response cookies
                // (so the browser persists them).
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                );
            },
        },
    });

    // Touch the session. getUser() validates the JWT, and if it's expired
    // @supabase/ssr uses the refresh token (from cookies) to mint a new
    // pair and writes it back via the setAll() above.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isApiCall = pathname.startsWith("/api/") || pathname.startsWith("/_next/");
    const isPage = !isApiCall && !/\.[a-zA-Z0-9]+$/.test(pathname);

    // Soft-lock write APIs + role shell gates need the users profile.
    // Grandfathered dealerships (subscription_status=active / null) never lock.
    if (user && (isMutatingApi(pathname, request.method) || isPage)) {
        const { data: profile } = await supabase
            .from("users")
            .select("dealership_id, is_platform_admin, role")
            .eq("id", user.id)
            .maybeSingle();

        if (profile && isPage) {
            // Platform shell — dealer users must not reach AdaptUs console pages
            // even if they type the URL (API already 403s; HTML shell was leaking).
            const isPlatformShell =
                pathname.startsWith("/platform") ||
                pathname === "/dealerships" ||
                pathname.startsWith("/dealerships/") ||
                pathname === "/settings/platform" ||
                pathname.startsWith("/settings/platform/");
            if (isPlatformShell && !profile.is_platform_admin) {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard";
                url.search = "";
                return NextResponse.redirect(url);
            }

            // Users admin page — Salesperson/Staff must not land on the shell
            const isUsersShell =
                pathname === "/users" || pathname.startsWith("/users/");
            if (
                isUsersShell &&
                !profile.is_platform_admin &&
                profile.role !== "Admin"
            ) {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard";
                url.search = "";
                return NextResponse.redirect(url);
            }
        }

        if (
            profile &&
            isMutatingApi(pathname, request.method) &&
            !profile.is_platform_admin &&
            profile.dealership_id
        ) {
            const { data: dealership } = await supabase
                .from("dealerships")
                .select("subscription_status, trial_ends_at")
                .eq("id", profile.dealership_id)
                .maybeSingle();

            if (isTrialSoftLockedRow(dealership)) {
                const locked = NextResponse.json(
                    {
                        error: "Trial expired",
                        code: "TRIAL_EXPIRED",
                        message:
                            "Your 7-day trial has ended. Contact AdaptUs to upgrade. Your data is retained.",
                    },
                    { status: 402 }
                );
                return corsOrigin ? applyCorsHeaders(locked, corsOrigin) : locked;
            }
        }
    }

    // Redirect rule: protected pages need a user.
    if (!user && !isPublic(pathname)) {
        // Decide: page or API?
        // - Pages (no extension, no /api/ prefix, no /_next/) → redirect to /login
        // - API calls → just pass through; they'll return 401 themselves
        //   and the centralized fetch wrapper handles the redirect.
        if (isPage) {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("next", pathname + request.nextUrl.search);
            return NextResponse.redirect(url);
        }
    }

    return corsOrigin ? applyCorsHeaders(response, corsOrigin) : response;
}

export const config = {
    // Run on everything except static assets and image optimization.
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
    ],
};
