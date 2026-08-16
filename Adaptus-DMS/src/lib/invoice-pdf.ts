/**
 * Shared invoice document engine — HTML print + client download helper + email body.
 * pdf-lib lives in invoice-pdf-bytes.ts (dynamic import on click).
 * Edge-safe print HTML (OpenNext CF Workers). No Puppeteer.
 */

import { invoiceEmail } from "@/src/lib/email";

export type InvoiceLineItem = {
    description: string;
    qty: number;
    unitPrice: number;
    amount: number;
};

export type InvoicePaymentRow = {
    date: string;
    amount: number;
    method?: string;
    note?: string;
};

export type InvoiceStatusStamp = "PAID" | "PARTIAL" | "OVERDUE" | "PENDING" | "CANCELLED";

/** Canonical document payload used by print HTML, pdf-lib, and email. */
export type InvoicePdfPayload = {
    invoiceNumber: string;
    invoiceDate?: string | null;
    dueDate?: string | null;
    status?: string | null;
    /** Resolved stamp for header (computed if omitted). */
    statusStamp?: InvoiceStatusStamp | null;
    packageName?: string | null;
    notes?: string | null;
    /** Payment instructions / footer copy (falls back to notes when unset). */
    paymentInstructions?: string | null;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    amountPaid?: number;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    dealerName?: string | null;
    dealerAddress?: string | null;
    dealerPhone?: string | null;
    dealerEmail?: string | null;
    dealerHst?: string | null;
    dealerLicence?: string | null;
    dealerLogoUrl?: string | null;
    lineItems?: InvoiceLineItem[];
    payments?: InvoicePaymentRow[];
};

/** Alias kept for call sites that prefer the richer name. */
export type InvoiceDocumentPayload = InvoicePdfPayload;

export function formatInvoiceCad(n: number | undefined): string {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(Number(n) || 0);
}

function money(n: number | undefined): string {
    return formatInvoiceCad(n);
}

function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function formatInvoiceDate(d: string | null | undefined): string {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return esc(d);
    }
}

function fmtDate(d: string | null | undefined): string {
    return formatInvoiceDate(d);
}

export function resolveInvoiceLineItems(data: {
    lineItems?: InvoiceLineItem[] | null;
    packageName?: string | null;
    subtotal: number;
}): InvoiceLineItem[] {
    const raw = data.lineItems;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((li) => {
            const qty = Number(li.qty) || 1;
            const unitPrice = Number(li.unitPrice) || 0;
            const amount =
                Number.isFinite(Number(li.amount)) && Number(li.amount) !== 0
                    ? Number(li.amount)
                    : qty * unitPrice;
            return {
                description: String(li.description || "").trim() || "Line item",
                qty,
                unitPrice,
                amount,
            };
        });
    }
    return [
        {
            description: data.packageName?.trim() || "Services / package",
            qty: 1,
            unitPrice: Number(data.subtotal) || 0,
            amount: Number(data.subtotal) || 0,
        },
    ];
}

export function resolveInvoiceStatusStamp(data: {
    status?: string | null;
    dueDate?: string | null;
    total: number;
    amountPaid?: number;
    nowMs?: number;
}): InvoiceStatusStamp {
    const status = (data.status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") return "CANCELLED";
    if (status === "paid") return "PAID";

    const total = Number(data.total) || 0;
    const paid = Number(data.amountPaid) || 0;
    if (total > 0 && paid >= total) return "PAID";
    if (paid > 0 && paid < total) return "PARTIAL";

    const now = data.nowMs ?? Date.now();
    if (
        data.dueDate &&
        status !== "paid" &&
        status !== "cancelled" &&
        new Date(data.dueDate).getTime() < now
    ) {
        return "OVERDUE";
    }
    if (status === "overdue") return "OVERDUE";
    if (status === "partial") return "PARTIAL";
    return "PENDING";
}

/** Normalize / fill derived fields so print, PDF, and email stay in sync. */
export function normalizeInvoiceDocument(
    data: InvoicePdfPayload,
    opts?: { nowMs?: number }
): InvoicePdfPayload {
    const lineItems = resolveInvoiceLineItems(data);
    const amountPaid = Number(data.amountPaid) || 0;
    const statusStamp =
        data.statusStamp ||
        resolveInvoiceStatusStamp({
            status: data.status,
            dueDate: data.dueDate,
            total: data.total,
            amountPaid,
            nowMs: opts?.nowMs,
        });
    return {
        ...data,
        lineItems,
        amountPaid,
        statusStamp,
        paymentInstructions:
            data.paymentInstructions?.trim() || data.notes?.trim() || null,
    };
}

function dealerHtmlBlock(data: InvoicePdfPayload): string {
    const logo =
        data.dealerLogoUrl?.trim()
            ? `<img src="${esc(data.dealerLogoUrl.trim())}" alt="" style="max-height:48px;max-width:160px;margin-bottom:8px;object-fit:contain"/>`
            : "";
    const lines = [
        logo,
        data.dealerName ? `<strong>${esc(data.dealerName)}</strong>` : "",
        data.dealerAddress ? `<p>${esc(data.dealerAddress)}</p>` : "",
        [data.dealerPhone, data.dealerEmail]
            .filter(Boolean)
            .map((x) => esc(String(x)))
            .join(" · "),
    ];
    const taxBits: string[] = [];
    if (data.dealerLicence?.trim()) {
        taxBits.push(`Dealer licence: ${esc(data.dealerLicence.trim())}`);
    }
    if (data.dealerHst?.trim()) {
        taxBits.push(`HST #: ${esc(data.dealerHst.trim())}`);
    }
    if (taxBits.length) {
        lines.push(`<p>${taxBits.join(" · ")}</p>`);
    }
    const body = lines.filter(Boolean).join("\n    ");
    return body || "<p class='muted'>Dealership</p>";
}

export function buildInvoicePrintHtml(raw: InvoicePdfPayload): string {
    const data = normalizeInvoiceDocument(raw);
    const balance = Math.max(
        0,
        (Number(data.total) || 0) - (Number(data.amountPaid) || 0)
    );
    const lineItems = data.lineItems || [];

    const customerLines = [
        data.customerName
            ? `<strong>${esc(data.customerName)}</strong>`
            : "<strong>Customer</strong>",
        data.customerAddress ? `<p>${esc(data.customerAddress)}</p>` : "",
        [data.customerPhone, data.customerEmail]
            .filter(Boolean)
            .map((x) => esc(String(x)))
            .join(" · "),
    ]
        .filter(Boolean)
        .join("\n    ");

    const chargeRows = lineItems
        .map(
            (li) =>
                `<tr>
          <td>${esc(li.description)}</td>
          <td class="amt">${esc(String(li.qty))}</td>
          <td class="amt">${money(li.unitPrice)}</td>
          <td class="amt">${money(li.amount)}</td>
        </tr>`
        )
        .join("\n");

    const paymentRows =
        data.payments && data.payments.length > 0
            ? data.payments
                  .map(
                      (p) =>
                          `<tr><td>${esc(fmtDate(p.date))}</td><td>${esc(p.method || "—")}</td><td class="amt">${money(p.amount)}</td><td>${esc(p.note || "")}</td></tr>`
                  )
                  .join("\n")
            : `<tr><td colspan="4" class="muted">No payments recorded</td></tr>`;

    const stamp = data.statusStamp || "PENDING";
    const footerCopy =
        data.paymentInstructions?.trim() ||
        "Thank you for your business. Contact the dealership with payment questions.";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Invoice ${esc(data.invoiceNumber)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #444; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .box { border: 1px solid #ddd; padding: 12px; background: #fafafa; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { font-size: 11px; text-transform: uppercase; color: #666; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; }
  .totals td { border: none; padding: 4px 8px; }
  .totals .strong { font-weight: 700; font-size: 15px; }
  .muted { color: #888; }
  .status { display: inline-block; padding: 2px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
  .status-PAID { border-color: #16a34a; color: #15803d; background: #f0fdf4; }
  .status-PARTIAL { border-color: #ca8a04; color: #a16207; background: #fefce8; }
  .status-OVERDUE { border-color: #dc2626; color: #b91c1c; background: #fef2f2; }
  .status-PENDING { border-color: #64748b; color: #475569; background: #f8fafc; }
  .status-CANCELLED { border-color: #94a3b8; color: #64748b; background: #f1f5f9; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #ddd; color: #555; font-size: 12px; white-space: pre-wrap; }
  @media print {
    body { margin: 12mm; }
    .status { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .box { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <h1>Invoice ${esc(data.invoiceNumber)}</h1>
  <p class="meta">
    Date: ${fmtDate(data.invoiceDate)} · Due: ${fmtDate(data.dueDate)}
    · <span class="status status-${esc(stamp)}">${esc(stamp)}</span>
  </p>

  <div class="grid">
    <div class="box">${dealerHtmlBlock(data)}</div>
    <div class="box">${customerLines}</div>
  </div>

  <h2>Charges</h2>
  <table>
    <thead>
      <tr><th>Description</th><th class="amt">Qty</th><th class="amt">Unit</th><th class="amt">Amount</th></tr>
    </thead>
    <tbody>
      ${chargeRows}
      <tr><td colspan="3">Tax (${Number(data.taxRate) || 0}%)</td><td class="amt">${money(data.taxAmount)}</td></tr>
    </tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="amt">${money(data.subtotal)}</td></tr>
    <tr><td>Total</td><td class="amt strong">${money(data.total)}</td></tr>
    <tr><td>Amount paid</td><td class="amt">${money(data.amountPaid)}</td></tr>
    <tr><td>Balance due</td><td class="amt strong">${money(balance)}</td></tr>
  </table>

  <h2>Payment ledger</h2>
  <table>
    <thead><tr><th>Date</th><th>Method</th><th class="amt">Amount</th><th>Note</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>

  ${data.notes?.trim() && data.notes.trim() !== footerCopy.trim() ? `<h2>Notes</h2><p>${esc(data.notes.trim())}</p>` : ""}

  <div class="footer">${esc(footerCopy)}</div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

export function openInvoicePrintWindow(data: InvoicePdfPayload): void {
    const html = buildInvoicePrintHtml(data);
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
        throw new Error("Pop-up blocked — allow pop-ups to generate the invoice PDF.");
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.opener = null;
}

export async function buildInvoicePdfBytes(
    raw: InvoicePdfPayload
): Promise<Uint8Array> {
    const { buildInvoicePdfBytes: build } = await import(
        "@/src/lib/invoice-pdf-bytes"
    );
    return build(raw);
}

/** Browser helper: download Invoice-{number}.pdf via blob. */
export async function downloadInvoicePdf(data: InvoicePdfPayload): Promise<void> {
    const bytes = await buildInvoicePdfBytes(data);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${data.invoiceNumber || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** Branded FlashFender invoice email — delegates to src/lib/email. */
export function invoiceEmailHtml(raw: InvoicePdfPayload): {
    subject: string;
    html: string;
    text: string;
} {
    const data = normalizeInvoiceDocument(raw);
    return invoiceEmail(data);
}

/** Parse line_items JSONB from API into InvoiceLineItem[]. */
export function parseInvoiceLineItems(raw: unknown): InvoiceLineItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const description = String(
                r.description ?? r.name ?? r.package_name ?? ""
            ).trim();
            const qty = Number(r.qty ?? r.quantity ?? 1) || 1;
            const unitPrice = Number(r.unitPrice ?? r.unit_price ?? r.price ?? 0) || 0;
            const amount =
                Number(r.amount ?? r.total ?? qty * unitPrice) || qty * unitPrice;
            if (!description && amount === 0) return null;
            return {
                description: description || "Line item",
                qty,
                unitPrice,
                amount,
            } satisfies InvoiceLineItem;
        })
        .filter((x): x is InvoiceLineItem => x !== null);
}
