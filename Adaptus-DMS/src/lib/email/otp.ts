/**
 * OTP / verify-email template — signup & login codes.
 */

import { FF, escHtml } from "./brands";
import {
  buildPlainText,
  renderEmailLayout,
  type EmailParts,
} from "./layout";

export type OtpEmailInput = {
  code: string;
  purpose: "signup" | "login";
  /** Expiry minutes shown in copy (default 15). */
  expiresMinutes?: number;
};

export function otpEmail(opts: OtpEmailInput): EmailParts {
  const expires = opts.expiresMinutes ?? 15;
  const label =
    opts.purpose === "signup" ? "Verify your email" : "Your login code";
  const subject = `${label}: ${opts.code}`;
  const code = escHtml(opts.code);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Use this one-time code to continue on FlashFender. It expires in <strong>${expires} minutes</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;">
      <tr>
        <td align="center" style="background:${FF.surface};border:1px solid ${FF.border};border-radius:10px;padding:20px 16px;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:${FF.charcoal};line-height:1.2;">
            ${code}
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:${FF.muted};">
      Never share this code with anyone. FlashFender staff will never ask for it.
    </p>`;

  const html = renderEmailLayout({
    preheader: `${label} — ${opts.code} expires in ${expires} minutes`,
    title: label,
    bodyHtml,
    footnoteHtml: `If you did not request this code, you can safely ignore this email.`,
  });

  const text = buildPlainText({
    title: label,
    lines: [
      `Your code is ${opts.code}.`,
      `It expires in ${expires} minutes.`,
      "",
      "Never share this code. If you did not request it, ignore this email.",
    ],
  });

  return { subject, html, text };
}
