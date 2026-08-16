/**
 * Shareable quotation summary (clipboard / email) — estimate only, no fake lender approval.
 */

import { quotationEmail } from "@/src/lib/email";

export type QuotationShareInput = {
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

function money(n: number | null | undefined): string {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(Number(n) || 0);
}

export function buildQuotationShareText(q: QuotationShareInput): string {
    const lines = [
        "Vehicle quotation — AdaptUs DMS",
        q.dealerName ? `Dealer: ${q.dealerName}` : null,
        q.quoteNumber ? `Quote #: ${q.quoteNumber}` : null,
        q.status ? `Status: ${q.status}` : null,
        q.customerName ? `Customer: ${q.customerName}` : null,
        q.vehicleLabel ? `Vehicle: ${q.vehicleLabel}` : null,
        q.validUntil ? `Valid until: ${q.validUntil}` : null,
        "",
        `Sale price:     ${money(q.salePrice)}`,
        `Tax rate:       ${q.taxRate ?? 13}%`,
        `Admin fee:      ${money(q.adminFee)}`,
        `Trade-in:       ${money(q.tradeInValue)}`,
        `Down payment:   ${money(q.downPayment)}`,
        q.interestRate != null ? `Rate:           ${q.interestRate}%` : null,
        q.financeTerm != null ? `Term:           ${q.financeTerm} months` : null,
        q.monthlyPayment != null
            ? `Est. monthly:   ${money(q.monthlyPayment)}`
            : null,
        q.notes ? `\nNotes: ${q.notes}` : null,
        "",
        "Estimate only — not a binding offer. Subject to lender approval and disclosure.",
        "Email delivery requires Resend (Settings → Integrations). Marking Sent does not send mail.",
    ];
    return lines.filter((l) => l !== null).join("\n");
}

/** Branded FlashFender quotation email — delegates to src/lib/email. */
export function quotationEmailHtml(q: QuotationShareInput): {
    subject: string;
    html: string;
    text: string;
} {
    return quotationEmail(q);
}
