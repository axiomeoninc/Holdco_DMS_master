/**
 * Shared FlashFender email shell — mobile table layout, preheader, CTA, footer.
 * Pure HTML string builders (OpenNext CF Workers — no React Email SSR).
 */

import { FF, FF_COPY, appBaseUrl, escHtml } from "./brands";

export type EmailCta = {
  label: string;
  url: string;
};

export type RenderLayoutInput = {
  /** Hidden preheader text (inbox preview). */
  preheader: string;
  /** Main heading inside the card. */
  title: string;
  /** HTML body blocks (paragraphs, tables, code, etc.). */
  bodyHtml: string;
  /** Optional primary CTA button. */
  cta?: EmailCta;
  /** Optional secondary note under CTA (expiry, security). */
  footnoteHtml?: string;
  /** Dealer/org line shown under wordmark when set. */
  dealerName?: string | null;
  /** Override footer support line. */
  supportEmail?: string;
};

export type EmailParts = {
  subject: string;
  html: string;
  text: string;
};

export function ctaButtonHtml(cta: EmailCta): string {
  const url = escHtml(cta.url);
  const label = escHtml(cta.label);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px">
      <tr>
        <td align="center" bgcolor="${FF.bolt}" style="border-radius:8px;background:${FF.bolt}">
          <a href="${url}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${FF.white};text-decoration:none;border-radius:8px;background:${FF.bolt}">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

export function renderEmailLayout(input: RenderLayoutInput): string {
  const support = escHtml(input.supportEmail || FF_COPY.supportEmail);
  const appUrl = escHtml(appBaseUrl());
  const dealer = input.dealerName ? escHtml(input.dealerName) : null;
  const preheader = escHtml(input.preheader);
  const title = escHtml(input.title);
  const ctaBlock = input.cta ? ctaButtonHtml(input.cta) : "";
  const footnote = input.footnoteHtml
    ? `<div style="margin-top:16px;font-size:13px;line-height:1.5;color:${FF.muted}">${input.footnoteHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${FF.surface};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${FF.surface};opacity:0;">
    ${preheader}${"\u00A0".repeat(40)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FF.surface};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <!-- Brand bar -->
          <tr>
            <td style="padding:0 0 16px;text-align:left;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <span style="display:inline-block;width:10px;height:28px;border-radius:2px;background:linear-gradient(180deg,${FF.flashRed} 0%,${FF.flashOrange} 100%);background-color:${FF.flashRed};"></span>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${FF.charcoal};line-height:1.2;">
                      FLASH<span style="color:${FF.bolt};">FENDER</span>
                    </div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${FF.muted};margin-top:2px;">
                      ${escHtml(FF_COPY.productTag)}
                    </div>
                  </td>
                </tr>
              </table>
              ${
                dealer
                  ? `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${FF.charcoalMuted};">From <strong style="color:${FF.charcoal};">${dealer}</strong></p>`
                  : ""
              }
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:${FF.white};border:1px solid ${FF.border};border-radius:12px;overflow:hidden;">
              <!-- Accent strip -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="4" style="height:4px;line-height:4px;font-size:0;background:${FF.bolt};background:linear-gradient(90deg,${FF.flashRed} 0%,${FF.flashOrange} 45%,${FF.bolt} 100%);">&nbsp;</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 24px 32px;font-family:Arial,Helvetica,sans-serif;color:${FF.ink};">
                    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${FF.charcoal};">
                      ${title}
                    </h1>
                    <div style="font-size:15px;line-height:1.6;color:${FF.charcoalMuted};">
                      ${input.bodyHtml}
                    </div>
                    ${ctaBlock}
                    ${footnote}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 8px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${FF.muted};">
              <p style="margin:0 0 6px;">
                Sent by <a href="${appUrl}" style="color:${FF.boltDark};text-decoration:none;font-weight:600;">${escHtml(FF_COPY.product)}</a>
              </p>
              <p style="margin:0;">
                Questions? <a href="mailto:${support}" style="color:${FF.boltDark};text-decoration:none;">${support}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Build a plain-text fallback from structured pieces. */
export function buildPlainText(parts: {
  title: string;
  lines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const blocks = [parts.title, "", ...parts.lines];
  if (parts.ctaLabel && parts.ctaUrl) {
    blocks.push("", `${parts.ctaLabel}: ${parts.ctaUrl}`);
  }
  blocks.push(
    "",
    parts.footer ||
      `${FF_COPY.product} · ${FF_COPY.supportEmail}`
  );
  return blocks.filter((l) => l !== null && l !== undefined).join("\n");
}
