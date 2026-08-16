// src/lib/utils.ts
// Utility helpers used across the app.

export function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}

/** Format a number as a US-locale currency string. */
export function formatCurrency(
    amount: number | string | null | undefined,
    options: { currency?: string; minimumFractionDigits?: number } = {}
): string {
    const { currency = "USD", minimumFractionDigits = 0 } = options;
    const n = typeof amount === "string" ? parseFloat(amount) : amount;
    if (n == null || isNaN(n)) return "—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits,
    }).format(n);
}

/** Compact number format (1.2K, 3.4M). */
export function formatCompact(n: number | null | undefined): string {
    if (n == null || isNaN(n)) return "—";
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n);
}

/** Relative time formatter (e.g. "2h ago", "yesterday"). */
export function timeAgo(iso: string | Date | null | undefined): string {
    if (!iso) return "—";
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const diff = Date.now() - d.getTime();
    if (diff < 0) return "just now";
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
}

/** Format a phone number for tel: links (strip non-digits, prepend +). */
export function phoneToTel(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    return `tel:${digits.startsWith("1") ? "+" + digits : "+1" + digits}`;
}

/** First letter of each word, uppercase, max 2. */
export function getInitials(name: string | null | undefined, max = 2): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts
        .slice(0, max)
        .map((p) => p[0])
        .join("")
        .toUpperCase();
}

/** Truncate a string with ellipsis. */
export function truncate(s: string, n: number): string {
    if (!s) return "";
    return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
