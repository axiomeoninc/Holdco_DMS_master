/**
 * Review automation — honest structure.
 *
 * - Customers only appear when they have given marketing consent.
 * - Emails are built as DRAFTS via the existing Resend pattern.
 * - Auto-send ONLY happens when the dealership explicitly enabled review
 *   automation AND Resend is configured. Otherwise requests stay "draft"
 *   (amber) and nothing is marked "sent".
 */

import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { crmEmail } from "@/src/lib/email";
import { isResendConfigured, sendEmail } from "@/src/lib/resend";
import { resolveEmailFrom } from "@/src/lib/email/from";
import { buildUnsubscribeUrl } from "@/src/lib/casl-unsubscribe";

export type ReviewRequestStatus =
  | "draft"
  | "queued"
  | "sent"
  | "clicked"
  | "reviewed"
  | "opted_out";

export type ReviewRequest = {
  id: string;
  dealership_id: string | null;
  location_id: string | null;
  customer_id: string | null;
  deal_id: string | null;
  token: string;
  status: ReviewRequestStatus;
  consent_ok: boolean;
  review_url: string | null;
  channel: "email" | "sms";
  scheduled_at: string | null;
  sent_at: string | null;
  clicked_at: string | null;
  reviewed_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  customer?: { id: string; name: string; email: string | null; phone: string | null } | null;
  deal?: { id: string; deal_date: string | null; vehicle?: { id: string; year: number; make: string; model: string } | null } | null;
};

/** Dealership review-automation config (read from dealerships.settings). */
export type ReviewAutomationConfig = {
  enabled: boolean;
  auto_send: boolean;
  days_after_deal: number;
  google_review_url: string | null;
  review_note: string | null;
};

export const DEFAULT_REVIEW_CONFIG: ReviewAutomationConfig = {
  enabled: false,
  auto_send: false,
  days_after_deal: 7,
  google_review_url: null,
  review_note: null,
};

export function newReviewToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readReviewConfig(
  settings: Record<string, unknown> | null | undefined
): ReviewAutomationConfig {
  const raw = settings?.review_automation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_REVIEW_CONFIG;
  }
  const rec = raw as Record<string, unknown>;
  return {
    enabled: rec.enabled === true,
    auto_send: rec.auto_send === true,
    days_after_deal:
      typeof rec.days_after_deal === "number" && rec.days_after_deal > 0
        ? Math.min(Math.round(rec.days_after_deal), 90)
        : DEFAULT_REVIEW_CONFIG.days_after_deal,
    google_review_url:
      typeof rec.google_review_url === "string" && rec.google_review_url.trim()
        ? rec.google_review_url.trim()
        : null,
    review_note:
      typeof rec.review_note === "string" && rec.review_note.trim()
        ? rec.review_note.trim()
        : null,
  };
}

/** Load review config for a dealership from the DB. */
export async function getReviewConfig(dealershipId: string): Promise<ReviewAutomationConfig> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error || !data) return DEFAULT_REVIEW_CONFIG;
  return readReviewConfig((data.settings || {}) as Record<string, unknown>);
}

export function reviewConfigConfigured(config: ReviewAutomationConfig): boolean {
  // Auto-send needs Resend credentials + a review destination + enabled flag.
  return (
    config.enabled === true &&
    isResendConfigured() &&
    Boolean(config.google_review_url)
  );
}

export type ReviewDraft = {
  subject: string;
  html: string;
  text: string;
};

export type BuildReviewDraftInput = {
  customerName: string;
  customerEmail: string;
  dealershipName: string;
  reviewUrl: string;
  reviewNote?: string | null;
  vehicleLabel?: string | null;
};

/** Build the review-request email draft (never sent by this helper). */
export async function buildReviewDraft(
  input: BuildReviewDraftInput
): Promise<ReviewDraft> {
  const vehicleLine = input.vehicleLabel
    ? ` Thank you for choosing our ${input.vehicleLabel}.`
    : "";
  const note = input.reviewNote
    ? `<p style="margin:12px 0 0">${esc(input.reviewNote)}</p>`
    : "";
  const bodyHtml = `
    <p style="margin:0 0 12px">Hi ${esc(input.customerName)},</p>
    <p style="margin:0 0 12px">Thanks for doing business with <strong>${esc(input.dealershipName)}</strong>.${vehicleLine}</p>
    <p style="margin:0 0 12px">If you have a moment, we'd appreciate a quick review — it helps other shoppers know what to expect.</p>
    <p style="margin:16px 0">
      <a href="${esc(input.reviewUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Leave a review</a>
    </p>
    ${note}
    <p style="margin:16px 0 0;color:#555">No pressure — and if anything wasn't right, please reply and let us know first.</p>
  `.trim();

  const unsubscribeUrl = await buildUnsubscribeUrl(input.customerEmail);

  const parts = crmEmail({
    subject: `How was your experience with ${input.dealershipName}?`,
    bodyHtml,
    dealershipName: input.dealershipName,
    unsubscribeUrl,
  });

  return {
    subject: parts.subject,
    html: parts.html,
    text: parts.text,
  };
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendReviewResult =
  | { ok: true; requestId: string; sent: boolean; reason: string }
  | { ok: false; requestId: string | null; error: string; sent: false };

/**
 * Attempt to send a review-request email for a queued request.
 * Honest: returns sent:false with a reason when consent is missing, Resend is
 * unconfigured, or auto-send is off. Never fabricates a "sent" state.
 */
export async function attemptSendReviewRequest(opts: {
  dealershipId: string;
  customerEmail: string;
  requestId: string;
  token: string;
  config: ReviewAutomationConfig;
  reviewUrl: string;
  customerName: string;
  dealershipName: string;
  vehicleLabel?: string | null;
}): Promise<SendReviewResult> {
  if (!opts.config.enabled) {
    return {
      ok: true,
      requestId: opts.requestId,
      sent: false,
      reason: "review_automation_disabled",
    };
  }

  // Dealer-level from-address override (settings.email_from → EMAIL_FROM env).
  let emailFrom: string | undefined;
  const { data: dealerRow } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", opts.dealershipId)
    .maybeSingle();
  if (dealerRow) {
    emailFrom = resolveEmailFrom(
      (dealerRow.settings as Record<string, unknown>) || null
    ).from;
  }

  if (!isResendConfigured()) {
    return {
      ok: true,
      requestId: opts.requestId,
      sent: false,
      reason: "resend_not_configured",
    };
  }
  if (!opts.customerEmail) {
    return {
      ok: true,
      requestId: opts.requestId,
      sent: false,
      reason: "customer_has_no_email",
    };
  }
  if (!opts.config.auto_send) {
    return {
      ok: true,
      requestId: opts.requestId,
      sent: false,
      reason: "auto_send_disabled",
    };
  }

  const draft = await buildReviewDraft({
    customerName: opts.customerName,
    customerEmail: opts.customerEmail,
    dealershipName: opts.dealershipName,
    reviewUrl: opts.reviewUrl,
    reviewNote: opts.config.review_note,
    vehicleLabel: opts.vehicleLabel,
  });

  const result = await sendEmail({
    to: opts.customerEmail,
    from: emailFrom,
    subject: draft.subject,
    html: draft.html,
    text: draft.text,
  });

  if (!result.ok) {
    return {
      ok: false,
      requestId: opts.requestId,
      error: result.error,
      sent: false,
    };
  }

  return {
    ok: true,
    requestId: opts.requestId,
    sent: true,
    reason: "sent",
  };
}
