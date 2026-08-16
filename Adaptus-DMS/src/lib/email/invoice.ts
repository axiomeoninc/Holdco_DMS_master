/**
 * Invoice email — line summary, totals, balance; PDF attached by send route.
 * Accepts InvoicePdfPayload-shaped objects without importing invoice-pdf (cycle-safe).
 */

import { FF, escHtml, fmtDateShort, moneyCad } from "./brands";
import {
  buildPlainText,
  renderEmailLayout,
  type EmailParts,
} from "./layout";

export type InvoiceEmailLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceEmailInput = {
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  statusStamp?: string | null;
  notes?: string | null;
  paymentInstructions?: string | null;
  subtotal?: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid?: number;
  customerName?: string | null;
  dealerName?: string | null;
  lineItems?: InvoiceEmailLineItem[];
};

export function invoiceEmail(raw: InvoiceEmailInput): EmailParts {
  const balance = Math.max(
    0,
    (Number(raw.total) || 0) - (Number(raw.amountPaid) || 0)
  );
  const subject = `Invoice ${raw.invoiceNumber} — ${moneyCad(raw.total)}`;
  const stamp = escHtml(raw.statusStamp || raw.status || "PENDING");
  const customer = raw.customerName ? escHtml(raw.customerName) : null;
  const lines =
    Array.isArray(raw.lineItems) && raw.lineItems.length > 0
      ? raw.lineItems
      : [];

  const lineRows = lines
    .map(
      (li) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid ${FF.border};color:${FF.charcoalMuted};font-size:14px;">${escHtml(li.description)}${
          li.qty > 1
            ? ` <span style="color:${FF.muted};font-size:12px;">×${li.qty}</span>`
            : ""
        }</td>
        <td style="padding:8px 0;border-bottom:1px solid ${FF.border};text-align:right;font-size:14px;color:${FF.charcoal};white-space:nowrap;">${moneyCad(li.amount)}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    ${customer ? `<p style="margin:0 0 12px;">Hi ${customer},</p>` : "<p style=\"margin:0 0 12px;\">Hello,</p>"}
    <p style="margin:0 0 16px;">
      Please find invoice <strong style="color:${FF.charcoal};">${escHtml(raw.invoiceNumber)}</strong>
      ${raw.dealerName ? ` from <strong style="color:${FF.charcoal};">${escHtml(raw.dealerName)}</strong>` : ""}.
      A PDF copy is attached.
    </p>
    <p style="margin:0 0 16px;">
      <span style="display:inline-block;padding:4px 10px;border:1px solid ${FF.border};border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${FF.charcoal};background:${FF.surface};">${stamp}</span>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
      ${lineRows || `<tr><td style="padding:8px 0;color:${FF.muted};font-size:14px;">No line items</td><td></td></tr>`}
      <tr>
        <td style="padding:10px 0 4px;color:${FF.muted};font-size:13px;">Tax (${Number(raw.taxRate) || 0}%)</td>
        <td style="padding:10px 0 4px;text-align:right;font-size:13px;color:${FF.charcoalMuted};">${moneyCad(raw.taxAmount)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:15px;color:${FF.charcoal};">Total</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;font-size:15px;color:${FF.charcoal};">${moneyCad(raw.total)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${FF.muted};font-size:14px;">Balance due</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;font-size:15px;color:${FF.boltDark};">${moneyCad(balance)}</td>
      </tr>
    </table>
    <p style="margin:12px 0 0;font-size:13px;color:${FF.muted};">Due date: ${escHtml(fmtDateShort(raw.dueDate))}</p>
    ${
      raw.paymentInstructions
        ? `<p style="margin:12px 0 0;font-size:13px;color:${FF.charcoalMuted};">${escHtml(raw.paymentInstructions)}</p>`
        : ""
    }`;

  const html = renderEmailLayout({
    preheader: `Invoice ${raw.invoiceNumber} · ${moneyCad(raw.total)} due ${fmtDateShort(raw.dueDate)}`,
    title: `Invoice ${raw.invoiceNumber}`,
    bodyHtml,
    dealerName: raw.dealerName,
  });

  const text = buildPlainText({
    title: `Invoice ${raw.invoiceNumber}`,
    lines: [
      raw.dealerName ? `From: ${raw.dealerName}` : "",
      `Status: ${raw.statusStamp || raw.status || "—"}`,
      `Customer: ${raw.customerName || "—"}`,
      `Total: ${moneyCad(raw.total)}`,
      `Balance due: ${moneyCad(balance)}`,
      `Due: ${raw.dueDate || "—"}`,
      raw.paymentInstructions ? `\n${raw.paymentInstructions}` : "",
      "",
      "A PDF copy is attached when delivery succeeds.",
    ].filter(Boolean) as string[],
  });

  return { subject, html, text };
}
