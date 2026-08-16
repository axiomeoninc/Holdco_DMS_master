/**
 * Stamp consent_at (and optional consent IP) when a consent flag flips.
 */
export function applyConsentTimestamps(
    next: Record<string, unknown>,
    prev?: {
        marketing_consent?: boolean | null;
        sms_consent?: boolean | null;
        marketing_consent_at?: string | null;
        sms_consent_at?: string | null;
        marketing_consent_ip?: string | null;
        sms_consent_ip?: string | null;
    } | null,
    opts?: { ip?: string | null }
): Record<string, unknown> {
    const out = { ...next };
    const now = new Date().toISOString();
    const ip = opts?.ip && opts.ip !== "unknown" ? opts.ip : null;

    if (typeof out.marketing_consent === "boolean") {
        if (out.marketing_consent) {
            if (!prev?.marketing_consent) {
                out.marketing_consent_at = now;
                if (ip) out.marketing_consent_ip = ip;
            } else if (prev.marketing_consent_at && out.marketing_consent_at === undefined) {
                out.marketing_consent_at = prev.marketing_consent_at;
            } else if (out.marketing_consent_at === undefined) {
                out.marketing_consent_at = now;
            }
        } else {
            out.marketing_consent_at = null;
            if (ip) out.marketing_consent_ip = ip;
            else if (prev?.marketing_consent) out.marketing_consent_ip = null;
        }
    }

    if (typeof out.sms_consent === "boolean") {
        if (out.sms_consent) {
            if (!prev?.sms_consent) {
                out.sms_consent_at = now;
                if (ip) out.sms_consent_ip = ip;
            } else if (prev.sms_consent_at && out.sms_consent_at === undefined) {
                out.sms_consent_at = prev.sms_consent_at;
            } else if (out.sms_consent_at === undefined) {
                out.sms_consent_at = now;
            }
        } else {
            out.sms_consent_at = null;
            if (ip) out.sms_consent_ip = ip;
            else if (prev?.sms_consent) out.sms_consent_ip = null;
        }
    }

    return out;
}
