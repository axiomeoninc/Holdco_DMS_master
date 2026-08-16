/** Normalize unknown thrown values to a readable message. */
export function errMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message.trim()) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string" && m.trim()) return m;
    }
    try {
        const s = String(err);
        if (s && s !== "[object Object]") return s;
    } catch {
        /* ignore */
    }
    return fallback;
}
