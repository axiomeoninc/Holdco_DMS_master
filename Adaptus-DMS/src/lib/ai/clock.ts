/**
 * Client-safe quiet-hours clock helpers. Kept free of next/headers and server
 * imports so client components can format quiet-hour windows without pulling
 * the server auth chain (guard.ts) into the client bundle.
 */

export function parseClock(value: string): number {
    const m = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
    if (!m) return NaN;
    const h = parseInt(m[1]!, 10);
    const min = parseInt(m[2]!, 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
    return h * 60 + min;
}

export function formatClock(value: string): string {
    const m = parseClock(value);
    if (Number.isNaN(m)) return value;
    const h = Math.floor(m / 60);
    const min = m % 60;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}
