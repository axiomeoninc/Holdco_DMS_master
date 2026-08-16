// src/lib/email/from.ts
// Resolve the from-address used by Resend for outgoing email.
// Priority: dealerships.settings.email_from (+ display_name) → EMAIL_FROM env → default.

export type EmailFromSource = "dealer" | "env" | "default";

export type ResolvedEmailFrom = {
  /** Full "Display Name <address@example.com>" or bare address to pass to Resend. */
  from: string;
  /** Dealer display name used to format a bare email_from. */
  displayName?: string;
  source: EmailFromSource;
};

const FORMATTED_FROM_RE = /<[^<>@\s]+@[^<>@\s]+>/;
const BARE_EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+$/;

/** Worker-level default sender: `EMAIL_FROM` env or the honest fallback. */
export function getEmailFrom(): string {
  return (
    process.env.EMAIL_FROM ||
    "FlashFender <noreply@flashfender.com>"
  );
}

/**
 * Resolve the sender for an email.
 *
 * 1. `settings.email_from` (a dealership-level override) if set. A bare
 *    address is formatted as `Display Name <addr>` when
 *    `settings.display_name` is present; an already-formatted value is used
 *    as-is.
 * 2. Otherwise the worker `EMAIL_FROM` env var.
 * 3. Otherwise the honest default from `getEmailFrom()`.
 *
 * Never fabricates a send — this only picks the From header. Config gating
 * (RESEND_API_KEY / EMAIL_FROM) still happens in `sendEmail`.
 */
export function resolveEmailFrom(
  settings?: Record<string, unknown> | null
): ResolvedEmailFrom {
  const raw = settings?.email_from;
  if (typeof raw === "string" && raw.trim()) {
    const value = raw.trim();
    if (FORMATTED_FROM_RE.test(value)) {
      return { from: value, source: "dealer" };
    }
    const displayName = settings?.display_name;
    if (
      BARE_EMAIL_RE.test(value) &&
      typeof displayName === "string" &&
      displayName.trim()
    ) {
      return {
        from: `${displayName.trim()} <${value}>`,
        displayName: displayName.trim(),
        source: "dealer",
      };
    }
    return { from: value, source: "dealer" };
  }

  const envFrom = process.env.EMAIL_FROM;
  if (envFrom) {
    return { from: envFrom, source: "env" };
  }

  return { from: getEmailFrom(), source: "default" };
}
