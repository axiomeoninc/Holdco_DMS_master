/**
 * Quotation email — estimate summary; PDF attached by send route.
 */

import { FF, escHtml, moneyCad } from "./brands";
import {
  buildPlainText,
  renderEmailLayout,
  type EmailParts,
} from "./layout";

/** Mirrors QuotationShareInput without importing quotation-share (avoids cycles). */
export type QuotationEmailInput = {
  quoteNumber?: string | null;
  status?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  vehicleLabel?: string | null;
  salePrice: number;
  downPayment?: number | null;
  tradeInValue?: number | null;
  financeTerm?: number | null;
  interestRate?: number | null;
  taxRate?: number | null;
  adminFee?: number | null;
  monthlyPayment?: number | null;
  notes?: string | null;
  validUntil?: string | null;
  dealerName?: string | null;
};

export function quotationEmail(q: QuotationEmailInput): EmailParts {
  const subject = q.quoteNumber
    ? `Your quotation ${q.quoteNumber}`
    : "Your vehicle quotation";

  const rows: Array<[string, string]> = [
    ["Sale price", moneyCad(q.salePrice)],
    ["Tax rate", `${q.taxRate ?? 13}%`],
    ["Admin fee", moneyCad(q.adminFee)],
    ["Trade-in", moneyCad(q.tradeInValue)],
    ["Down payment", moneyCad(q.downPayment)],
  ];
  if (q.interestRate != null) rows.push(["Rate", `${q.interestRate}%`]);
  if (q.financeTerm != null) {
    rows.push(["Term", `${q.financeTerm} months`]);
  }
  if (q.monthlyPayment != null) {
    rows.push(["Est. monthly", moneyCad(q.monthlyPayment)]);
  }

  const tableRows = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid ${FF.border};color:${FF.muted};font-size:14px;">${escHtml(k)}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${FF.border};text-align:right;font-weight:600;font-size:14px;color:${FF.charcoal};">${escHtml(v)}</td>
      </tr>`
    )
    .join("");

  const greeting = q.customerName
    ? `Hi ${escHtml(q.customerName)},`
    : "Hello,";

  const bodyHtml = `
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 16px;">
      Here is your vehicle quotation
      ${q.quoteNumber ? ` <strong style="color:${FF.charcoal};">${escHtml(q.quoteNumber)}</strong>` : ""}
      ${q.dealerName ? ` from <strong style="color:${FF.charcoal};">${escHtml(q.dealerName)}</strong>` : ""}.
      A PDF copy is attached.
    </p>
    ${
      q.vehicleLabel
        ? `<p style="margin:0 0 16px;padding:12px 14px;background:${FF.surface};border-left:3px solid ${FF.bolt};border-radius:0 6px 6px 0;font-size:14px;color:${FF.charcoal};"><strong>Vehicle</strong><br/>${escHtml(q.vehicleLabel)}</p>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
      ${tableRows}
    </table>
    ${
      q.notes
        ? `<p style="margin:12px 0 0;font-size:13px;color:${FF.charcoalMuted};"><strong>Notes:</strong> ${escHtml(q.notes)}</p>`
        : ""
    }
    ${
      q.validUntil
        ? `<p style="margin:8px 0 0;font-size:13px;color:${FF.muted};">Valid until: ${escHtml(q.validUntil)}</p>`
        : ""
    }
    <p style="margin:16px 0 0;font-size:12px;color:${FF.muted};line-height:1.5;">
      Estimate only — not a binding offer. Subject to lender approval and disclosure requirements.
    </p>`;

  const html = renderEmailLayout({
    preheader: q.vehicleLabel
      ? `Quotation${q.quoteNumber ? ` ${q.quoteNumber}` : ""} — ${q.vehicleLabel}`
      : `Your vehicle quotation${q.quoteNumber ? ` ${q.quoteNumber}` : ""}`,
    title: q.quoteNumber
      ? `Quotation ${q.quoteNumber}`
      : "Vehicle quotation",
    bodyHtml,
    dealerName: q.dealerName,
  });

  const textLines = [
    "Vehicle quotation — FlashFender",
    q.dealerName ? `Dealer: ${q.dealerName}` : null,
    q.quoteNumber ? `Quote #: ${q.quoteNumber}` : null,
    q.status ? `Status: ${q.status}` : null,
    q.customerName ? `Customer: ${q.customerName}` : null,
    q.vehicleLabel ? `Vehicle: ${q.vehicleLabel}` : null,
    q.validUntil ? `Valid until: ${q.validUntil}` : null,
    "",
    `Sale price:     ${moneyCad(q.salePrice)}`,
    `Tax rate:       ${q.taxRate ?? 13}%`,
    `Admin fee:      ${moneyCad(q.adminFee)}`,
    `Trade-in:       ${moneyCad(q.tradeInValue)}`,
    `Down payment:   ${moneyCad(q.downPayment)}`,
    q.interestRate != null ? `Rate:           ${q.interestRate}%` : null,
    q.financeTerm != null ? `Term:           ${q.financeTerm} months` : null,
    q.monthlyPayment != null
      ? `Est. monthly:   ${moneyCad(q.monthlyPayment)}`
      : null,
    q.notes ? `\nNotes: ${q.notes}` : null,
    "",
    "Estimate only — not a binding offer. Subject to lender approval and disclosure.",
    "A PDF copy is attached when delivery succeeds.",
  ].filter((l) => l !== null) as string[];

  const text = buildPlainText({
    title: subject,
    lines: textLines,
  });

  return { subject, html, text };
}
