/**
 * Staff invite / welcome email after admin creates a user.
 */

import { FF, appBaseUrl, escHtml } from "./brands";
import {
  buildPlainText,
  renderEmailLayout,
  type EmailParts,
} from "./layout";

export type InviteEmailInput = {
  recipientName: string;
  recipientEmail: string;
  role: string;
  /** Dealership display name when tenant-scoped. */
  dealershipName?: string | null;
  /** Prefer setup/reset link when available; otherwise login URL. */
  setupUrl?: string | null;
  loginUrl?: string | null;
  /** When true, admin set a temporary password — remind them to change it. */
  passwordWasSetByAdmin?: boolean;
};

export function inviteEmail(opts: InviteEmailInput): EmailParts {
  const name = escHtml(opts.recipientName);
  const role = escHtml(opts.role);
  const dealer = opts.dealershipName
    ? escHtml(opts.dealershipName)
    : null;
  const loginUrl =
    opts.loginUrl || `${appBaseUrl()}/login`;
  const setupUrl = opts.setupUrl?.trim() || null;
  const ctaUrl = setupUrl || loginUrl;
  const ctaLabel = setupUrl ? "Set your password" : "Sign in to FlashFender";

  const subject = dealer
    ? `You're invited to ${opts.dealershipName} on FlashFender`
    : "You're invited to FlashFender";

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${name},</p>
    <p style="margin:0 0 12px;">
      An account has been created for you on <strong style="color:${FF.charcoal};">FlashFender</strong>
      ${dealer ? ` for <strong style="color:${FF.charcoal};">${dealer}</strong>` : ""}.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0 16px;background:${FF.surface};border:1px solid ${FF.border};border-radius:8px;">
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:${FF.charcoalMuted};">
          <div style="margin:0 0 6px;"><span style="color:${FF.muted};">Email</span><br/><strong style="color:${FF.charcoal};">${escHtml(opts.recipientEmail)}</strong></div>
          <div style="margin:0;"><span style="color:${FF.muted};">Role</span><br/><strong style="color:${FF.charcoal};">${role}</strong></div>
        </td>
      </tr>
    </table>
    ${
      setupUrl
        ? `<p style="margin:0 0 8px;">Use the button below to set your password and get started. The link expires in 30 minutes.</p>`
        : opts.passwordWasSetByAdmin
          ? `<p style="margin:0 0 8px;">Your admin set a password for you. Sign in with the email above, then change your password from Settings if needed.</p>`
          : `<p style="margin:0 0 8px;">Sign in with the credentials your admin shared with you.</p>`
    }`;

  const html = renderEmailLayout({
    preheader: dealer
      ? `Welcome to ${opts.dealershipName} on FlashFender`
      : "Welcome to FlashFender — your staff account is ready",
    title: "Welcome aboard",
    bodyHtml,
    dealerName: opts.dealershipName,
    cta: { label: ctaLabel, url: ctaUrl },
    footnoteHtml: setupUrl
      ? `If the button does not work, open:<br/><a href="${escHtml(setupUrl)}" style="color:${FF.boltDark};word-break:break-all;font-size:12px;">${escHtml(setupUrl)}</a>`
      : `Login: <a href="${escHtml(loginUrl)}" style="color:${FF.boltDark};">${escHtml(loginUrl)}</a>`,
  });

  const text = buildPlainText({
    title: subject,
    lines: [
      `Hi ${opts.recipientName},`,
      "",
      dealer
        ? `An account has been created for you at ${opts.dealershipName} on FlashFender.`
        : "An account has been created for you on FlashFender.",
      `Email: ${opts.recipientEmail}`,
      `Role: ${opts.role}`,
      "",
      setupUrl
        ? "Use the link below to set your password (expires in 30 minutes)."
        : opts.passwordWasSetByAdmin
          ? "Your admin set a password — sign in, then change it if needed."
          : "Sign in with the credentials your admin shared.",
    ],
    ctaLabel,
    ctaUrl,
  });

  return { subject, html, text };
}
