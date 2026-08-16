// src/lib/resend.ts
// Thin Resend wrapper. If RESEND_API_KEY is missing, send helpers return
// a clear error — never fake a successful send.
// Template HTML lives in src/lib/email — helpers below re-export for call sites.

import {
  forgotPasswordEmail,
  otpEmail,
} from "@/src/lib/email";
import { resolveEmailFrom } from "@/src/lib/email/from";

export type SendEmailAttachment = {
  /** File name shown to the recipient, e.g. Invoice-INV-2024.pdf */
  filename: string;
  /** Base64-encoded file content (Resend API). */
  content: string;
  /** Optional MIME type; defaults to application/octet-stream server-side. */
  contentType?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Absolute unsubscribe URL — adds List-Unsubscribe (+ One-Click) headers when set. */
  listUnsubscribeUrl?: string;
  /** Optional file attachments (PDF invoices, etc.). */
  attachments?: SendEmailAttachment[];
  /**
   * Optional sender override (e.g. `dealerships.settings.email_from`).
   * Falls back to `process.env.EMAIL_FROM` when omitted.
   */
  from?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; missingConfig?: boolean };

/**
 * True when Resend can actually send: RESEND_API_KEY present AND a usable
 * from-address exists — either the worker `EMAIL_FROM` env or a dealership
 * `settings.email_from` override (Settings → Business → Email).
 *
 * Zero-arg callers keep the historical behavior (RESEND_API_KEY && EMAIL_FROM);
 * pass dealership `settings` to also honour a dealer override.
 */
export function isResendConfigured(
  settings?: Record<string, unknown> | null
): boolean {
  if (!process.env.RESEND_API_KEY) return false;
  if (process.env.EMAIL_FROM) return true;
  return resolveEmailFrom(settings).source === "dealer";
}

export { getEmailFrom } from "@/src/lib/email/from";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      missingConfig: true,
      error:
        "RESEND_API_KEY is not configured. Set RESEND_API_KEY and EMAIL_FROM (verified domain) in the Worker env.",
    };
  }

  const from = input.from || process.env.EMAIL_FROM;
  if (!from) {
    return {
      ok: false,
      missingConfig: true,
      error:
        "No from-address configured. Set a dealership email_from (Settings → Integrations) or EMAIL_FROM in the Worker env. Example: FlashFender <noreply@flashfender.com>",
    };
  }

  try {
    const emailHeaders: Record<string, string> | undefined = input.listUnsubscribeUrl
      ? {
          "List-Unsubscribe": `<${input.listUnsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(emailHeaders ? { headers: emailHeaders } : {}),
        ...(input.attachments && input.attachments.length > 0
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: body.message || body.name || `Resend error (${res.status})`,
      };
    }

    return { ok: true, id: body.id || "unknown" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

/** @deprecated Prefer `otpEmail` from `@/src/lib/email` — kept for existing imports. */
export function otpEmailHtml(opts: {
  code: string;
  purpose: "signup" | "login";
}): { subject: string; html: string; text: string } {
  return otpEmail(opts);
}

/** @deprecated Prefer `forgotPasswordEmail` from `@/src/lib/email`. */
export function resetPasswordEmailHtml(opts: {
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  return forgotPasswordEmail(opts);
}

export { otpEmail, forgotPasswordEmail, inviteEmail } from "@/src/lib/email";
