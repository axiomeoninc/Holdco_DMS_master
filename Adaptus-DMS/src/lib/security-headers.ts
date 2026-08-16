// src/lib/security-headers.ts
// Single source of truth for HTTP security headers.
//
// The reason this file exists (P1-4): Next.js's `headers()` in
// next.config.ts is NOT applied by OpenNext on Cloudflare (issue
// opennextjs-cloudflare#107). So we set headers in `src/worker.ts`
// for the production Cloudflare deploy, and we set them in
// next.config.ts for local dev. Both must stay in sync.
//
// Rather than risk drift between two literal arrays, both consumers
// import from this module. If you change a header, change it here.
//
// The `Content-Security-Policy` value intentionally allows 'unsafe-inline'
// (Next.js inline styles) and 'unsafe-eval' (recharts/Chart.js in dev).
// Tighten once we move charts to a non-eval backend and the dev path
// stops needing it.

const SUPABASE_HOST = "zwfeitodxikdwymkieai.supabase.co";

// Cloudflare Web Analytics beacon (if enabled on the zone) loads from
// static.cloudflareinsights.com and posts to cloudflareinsights.com.
// Prefer disabling RUM on the zone; these allowlists keep console clean
// when analytics remains on.
const CSP_VALUE = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${SUPABASE_HOST} https://hillzcdn.ca`,
    "font-src 'self' data:",
    `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://cloudflareinsights.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

/**
 * The headers applied to every response in production (Cloudflare) and
 * local dev. Keys are case-insensitive at apply-time; pick one casing and
 * stick to it.
 *
 * The type is intentionally a mutable `{ key: string; value: string }[]`
 * so `next.config.ts`'s `headers()` accepts it without spreading. The
 * Cloudflare worker uses the `_MAP` form below.
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "Content-Security-Policy", value: CSP_VALUE },
];

type HeaderPair = { key: string; value: string };

function toMap(headers: HeaderPair[]): Record<string, string> {
    return headers.reduce<Record<string, string>>((acc, h) => {
        acc[h.key] = h.value;
        return acc;
    }, {});
}

/**
 * Public inventory widget + hosted showroom may be iframed on any dealer site.
 * Dashboard and APIs stay unframed.
 */
export function isPubliclyFrameablePath(pathname: string): boolean {
    const p = pathname.split("?")[0] || "/";
    return (
        p === "/embed" ||
        p.startsWith("/embed/") ||
        p === "/showroom" ||
        p.startsWith("/showroom/")
    );
}

const CSP_EMBED = CSP_VALUE.replace("frame-ancestors 'none'", "frame-ancestors *");

/** Headers for `/embed` and `/showroom` — no X-Frame-Options, dealers may iframe. */
export const EMBED_FRAME_HEADERS: HeaderPair[] = SECURITY_HEADERS.filter(
    (h) => h.key !== "X-Frame-Options"
).map((h) =>
    h.key === "Content-Security-Policy" ? { key: h.key, value: CSP_EMBED } : h
);

export function securityHeadersForPath(pathname: string): HeaderPair[] {
    return isPubliclyFrameablePath(pathname) ? EMBED_FRAME_HEADERS : SECURITY_HEADERS;
}

export function securityHeadersMapForPath(pathname: string): Record<string, string> {
    return toMap(securityHeadersForPath(pathname));
}

/**
 * The same headers as a `Record<string, string>` for the Cloudflare worker
 * (which uses `.set(key, value)` instead of an array).
 */
export const SECURITY_HEADERS_MAP: Readonly<Record<string, string>> =
    Object.freeze(toMap(SECURITY_HEADERS));

/** Exported so tests and the worker can introspect / assert the CSP. */
export const CSP = CSP_VALUE;
export const CSP_PUBLIC_EMBED = CSP_EMBED;
