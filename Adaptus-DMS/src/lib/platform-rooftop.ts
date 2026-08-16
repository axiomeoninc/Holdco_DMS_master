/** Platform "Act as dealership" picker — cookie / query / header. Dealers must ignore these. */

export const DEALERSHIP_COOKIE = "dealership_id";
export const DEALERSHIP_HEADER = "X-Dealership-Id";
export const ROOFTOP_CHANGE_EVENT = "adaptus:rooftop";

export type RooftopRequest = {
    url: string;
    headers?: { get: (name: string) => string | null };
    cookies?: { get: (name: string) => { value: string } | undefined };
};

/** Trimmed rooftop id, or null. Never `""` (that must not be used as a filter). */
export function nonEmptyDealershipId(
    raw: string | null | undefined
): string | null {
    const value = typeof raw === "string" ? raw.trim() : "";
    return value || null;
}

/**
 * Priority: explicit arg → `?dealership_id=` → `X-Dealership-Id` → cookie.
 * Callers must only use this for `is_platform_admin`.
 */
export function readExplicitDealershipId(
    req: RooftopRequest,
    explicit?: string | null
): string | null {
    const fromArg = nonEmptyDealershipId(explicit);
    if (fromArg) return fromArg;

    try {
        const fromQuery = nonEmptyDealershipId(
            new URL(req.url).searchParams.get("dealership_id")
        );
        if (fromQuery) return fromQuery;
    } catch {
        // ignore invalid URL
    }

    const fromHeader = nonEmptyDealershipId(
        req.headers?.get("x-dealership-id") ||
            req.headers?.get(DEALERSHIP_HEADER)
    );
    if (fromHeader) return fromHeader;

    return nonEmptyDealershipId(req.cookies?.get(DEALERSHIP_COOKIE)?.value);
}

export function readDealershipCookieFromDocument(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
        /(?:^|;\s*)dealership_id=([^;]*)/
    );
    if (!match?.[1]) return null;
    try {
        return nonEmptyDealershipId(decodeURIComponent(match[1]));
    } catch {
        return nonEmptyDealershipId(match[1]);
    }
}

export function writeDealershipCookie(id: string | null): void {
    if (typeof document === "undefined") return;
    const rooftop = nonEmptyDealershipId(id);
    if (rooftop) {
        document.cookie = `${DEALERSHIP_COOKIE}=${encodeURIComponent(rooftop)}; Path=/; SameSite=Lax; Max-Age=2592000`;
    } else {
        document.cookie = `${DEALERSHIP_COOKIE}=; Path=/; Max-Age=0`;
    }
    window.dispatchEvent(new Event(ROOFTOP_CHANGE_EVENT));
}
