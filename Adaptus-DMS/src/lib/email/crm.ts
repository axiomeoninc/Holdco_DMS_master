/**
 * CRM sequence wrapper — place step HTML inside FlashFender layout.
 */

import { FF, escHtml } from "./brands";
import {
  buildPlainText,
  renderEmailLayout,
  type EmailParts,
} from "./layout";

export type CrmEmailWrapInput = {
  subject: string;
  /** Already-rendered step HTML (variables substituted). */
  bodyHtml: string;
  /** Optional plain text; derived from a strip if omitted. */
  bodyText?: string | null;
  dealershipName?: string | null;
  /** Absolute unsubscribe URL for CASL footer. */
  unsubscribeUrl?: string | null;
};

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function crmEmail(opts: CrmEmailWrapInput): EmailParts {
  const dealer = opts.dealershipName || null;
  const unsub = opts.unsubscribeUrl?.trim() || null;

  const wrappedBody = `
    <div style="font-size:15px;line-height:1.6;color:${FF.charcoalMuted};">
      ${opts.bodyHtml}
    </div>
    ${
      unsub
        ? `<hr style="border:none;border-top:1px solid ${FF.border};margin:24px 0 12px"/>
           <p style="margin:0;font-size:12px;line-height:1.5;color:${FF.muted};">
             You received this because you consented to marketing email from ${escHtml(dealer || "your dealership")}.
             <a href="${escHtml(unsub)}" style="color:${FF.boltDark};">Unsubscribe</a>.
           </p>`
        : ""
    }`;

  // Title is soft — CRM subjects are the real headline in the inbox.
  const html = renderEmailLayout({
    preheader: stripTags(opts.bodyHtml).slice(0, 120),
    title: dealer ? `Message from ${dealer}` : "A message for you",
    bodyHtml: wrappedBody,
    dealerName: dealer,
  });

  const textBase =
    opts.bodyText?.trim() ||
    stripTags(opts.bodyHtml) ||
    opts.subject;
  const text = buildPlainText({
    title: opts.subject,
    lines: [
      textBase,
      "",
      unsub
        ? `Unsubscribe: ${unsub}`
        : "",
    ].filter(Boolean) as string[],
    footer: dealer
      ? `${dealer} via FlashFender`
      : undefined,
  });

  return { subject: opts.subject, html, text };
}
