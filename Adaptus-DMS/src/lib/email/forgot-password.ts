/**
 * Forgot-password / reset-link template.
 */

import { FF, escHtml } from "./brands";
import {
  buildPlainText,
  renderEmailLayout,
  type EmailParts,
} from "./layout";

export type ForgotPasswordEmailInput = {
  resetUrl: string;
  /** Link expiry minutes (default 30). */
  expiresMinutes?: number;
  recipientName?: string | null;
};

export function forgotPasswordEmail(
  opts: ForgotPasswordEmailInput
): EmailParts {
  const expires = opts.expiresMinutes ?? 30;
  const subject = "Reset your FlashFender password";
  const url = opts.resetUrl;
  const greeting = opts.recipientName
    ? `Hi ${escHtml(opts.recipientName)},`
    : "Hi,";

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">
      We received a request to reset your FlashFender password. Click the button below to choose a new one.
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:${FF.muted};">
      This link expires in <strong style="color:${FF.charcoalMuted};">${expires} minutes</strong>.
    </p>`;

  const html = renderEmailLayout({
    preheader: `Reset your password — link expires in ${expires} minutes`,
    title: "Reset your password",
    bodyHtml,
    cta: { label: "Reset password", url },
    footnoteHtml: `
      If the button does not work, paste this link into your browser:<br/>
      <a href="${escHtml(url)}" style="color:${FF.boltDark};word-break:break-all;font-size:12px;">${escHtml(url)}</a>
      <br/><br/>
      If you did not request a reset, ignore this email — your password will stay the same.`,
  });

  const text = buildPlainText({
    title: "Reset your FlashFender password",
    lines: [
      opts.recipientName ? `Hi ${opts.recipientName},` : "Hi,",
      "",
      "We received a request to reset your password.",
      `This link expires in ${expires} minutes.`,
      "",
      "If you did not request this, ignore this email.",
    ],
    ctaLabel: "Reset password",
    ctaUrl: url,
  });

  return { subject, html, text };
}
