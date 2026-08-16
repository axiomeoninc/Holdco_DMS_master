// Tight CORS allowlist for Expo web (Metro) talking to the desk API with
// credentials + Bearer. Same-origin desk traffic is unchanged: non-allowlisted
// Origins get no Access-Control-* headers.

import { NextResponse, type NextRequest } from "next/server";

const EXPO_WEB_ORIGINS = new Set([
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]);

const CORS_ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_ALLOW_HEADERS = "Authorization, Content-Type, Accept, X-Requested-With";

export function getAllowlistedCorsOrigin(request: NextRequest): string | null {
    const origin = request.headers.get("origin");
    if (!origin || !EXPO_WEB_ORIGINS.has(origin)) return null;
    return origin;
}

export function applyCorsHeaders(
    response: NextResponse,
    origin: string
): NextResponse {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
    response.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
    response.headers.set("Vary", "Origin");
    return response;
}

/** Preflight response for allowlisted Expo web Origins hitting /api/*. */
export function corsPreflightResponse(origin: string): NextResponse {
    const response = new NextResponse(null, { status: 204 });
    return applyCorsHeaders(response, origin);
}

export function isApiPath(pathname: string): boolean {
    return pathname.startsWith("/api/");
}
