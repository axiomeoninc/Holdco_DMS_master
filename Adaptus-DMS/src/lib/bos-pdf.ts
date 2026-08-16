/**
 * Browser print-to-PDF helper for Bill of Sale (no heavy PDF lib on CF Workers).
 * Phase 2 Lane B: dealer business_* / licence / HST block from settings when set.
 * Financing schedule from modal fields — not a full UCDA/MVDA legal form.
 */

export type BosPdfDealer = {
    name?: string | null;
    business_name?: string | null;
    business_address?: string | null;
    business_phone?: string | null;
    business_email?: string | null;
    dealer_license?: string | null;
    /** HST / GST registration from business settings */
    hst_number?: string | null;
};

export type BosPdfPaymentRow = {
    paymentName?: string;
    paymentType?: string;
    amount?: number;
    paymentDate?: string;
};

export type BosPdfFinancing = {
    amountToFinance?: number;
    paymentType?: string;
    costOfBorrowing?: number;
    paymentStartDate?: string | null;
    payments?: BosPdfPaymentRow[];
};

export type BosPdfPayload = {
    dealer?: BosPdfDealer | null;
    vehicleLabel?: string;
    vin?: string;
    stockNumber?: string;
    customerName?: string;
    customerAddress?: string;
    saleType?: string;
    priceVehicle?: number;
    tradeInAllowance?: number;
    gstAmount?: number;
    pstAmount?: number;
    totalPurchasePrice?: number;
    totalBalanceDue?: number;
    deposit?: number;
    notes?: string;
    tradeInDisclosure?: string;
    paymentStatus?: string;
    dealDate?: string;
    /** Watermark for fixture / sample proofs */
    sampleBanner?: string;
    financing?: BosPdfFinancing | null;
};

function money(n: number | undefined): string {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(Number(n) || 0);
}

function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function dealerBusinessBlock(dealer: BosPdfDealer | null | undefined): string {
    if (!dealer) return "";

    const dealerName = esc(
        dealer.business_name || dealer.name || "Dealership"
    );
    const lines: string[] = [`<strong>${dealerName}</strong>`];

    if (dealer.business_address?.trim()) {
        lines.push(`<p>${esc(dealer.business_address.trim())}</p>`);
    }

    const contact = [dealer.business_phone, dealer.business_email]
        .filter((x) => Boolean(x && String(x).trim()))
        .map((x) => esc(String(x).trim()))
        .join(" · ");
    if (contact) {
        lines.push(`<p>${contact}</p>`);
    }

    const taxBits: string[] = [];
    if (dealer.dealer_license?.trim()) {
        taxBits.push(`Dealer licence: ${esc(dealer.dealer_license.trim())}`);
    }
    if (dealer.hst_number?.trim()) {
        taxBits.push(`HST #: ${esc(dealer.hst_number.trim())}`);
    }
    if (taxBits.length) {
        lines.push(`<p>${taxBits.join(" · ")}</p>`);
    }

    return `<h2>Dealership</h2>
  <div class="meta dealer-block">
    ${lines.join("\n    ")}
  </div>`;
}

function hasFinancingContent(fin: BosPdfFinancing | null | undefined): boolean {
    if (!fin) return false;
    if ((fin.amountToFinance ?? 0) > 0) return true;
    if (fin.paymentType?.trim()) return true;
    if ((fin.costOfBorrowing ?? 0) > 0) return true;
    if (fin.paymentStartDate) return true;
    if (fin.payments && fin.payments.length > 0) return true;
    return false;
}

function financingBlock(fin: BosPdfFinancing | null | undefined): string {
    if (!hasFinancingContent(fin) || !fin) return "";

    const detailRows: string[] = [];
    if ((fin.amountToFinance ?? 0) > 0 || fin.paymentType?.trim()) {
        detailRows.push(
            `<tr><td>Amount to finance</td><td class="amt">${money(fin.amountToFinance)}</td></tr>`
        );
    }
    if (fin.paymentType?.trim()) {
        detailRows.push(
            `<tr><td>Payment frequency</td><td class="amt">${esc(fin.paymentType.trim())}</td></tr>`
        );
    }
    if ((fin.costOfBorrowing ?? 0) > 0) {
        detailRows.push(
            `<tr><td>Cost of borrowing</td><td class="amt">${money(fin.costOfBorrowing)}</td></tr>`
        );
    }
    if (fin.paymentStartDate) {
        detailRows.push(
            `<tr><td>Payment start date</td><td class="amt">${esc(fin.paymentStartDate)}</td></tr>`
        );
    }

    const payments = fin.payments || [];
    let scheduleHtml = "";
    if (payments.length > 0) {
        const rows = payments
            .map(
                (p) => `<tr>
      <td>${esc(p.paymentName || "—")}</td>
      <td>${esc(p.paymentType || "—")}</td>
      <td class="amt">${money(p.amount)}</td>
      <td class="amt">${esc(p.paymentDate || "—")}</td>
    </tr>`
            )
            .join("\n    ");
        scheduleHtml = `
  <h3 class="subhead">Payment schedule</h3>
  <table class="sched">
    <thead>
      <tr><th>Name</th><th>Type</th><th class="amt">Amount</th><th class="amt">Date</th></tr>
    </thead>
    <tbody>
    ${rows}
    </tbody>
  </table>`;
    }

    return `
  <h2>Financing</h2>
  <p class="honesty">Informational schedule from deal data — not a certified UCDA / MVDA legal form.</p>
  ${detailRows.length ? `<table>${detailRows.join("\n    ")}</table>` : ""}
  ${scheduleHtml}`;
}

export function buildBosPrintHtml(data: BosPdfPayload): string {
    const banner = data.sampleBanner?.trim()
        ? `<div class="sample-banner">${esc(data.sampleBanner.trim())}</div>`
        : "";

    const disclosureSections: string[] = [];
    if (data.notes?.trim()) {
        disclosureSections.push(
            `<h2>Notes / disclosure</h2><div class="notes">${esc(data.notes.trim())}</div>`
        );
    }
    if (data.tradeInDisclosure?.trim()) {
        disclosureSections.push(
            `<h2>Trade-in disclosure</h2><div class="notes">${esc(data.tradeInDisclosure.trim())}</div>`
        );
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Bill of Sale</title>
<style>
  body { font-family: Georgia, serif; color: #111; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3.subhead { font-size: 12px; margin: 16px 0 6px; font-weight: 700; }
  .meta { color: #444; margin-bottom: 12px; }
  .dealer-block { border: 1px solid #ddd; padding: 12px; background: #fafafa; }
  .sample-banner { background: #fff3cd; border: 1px solid #e6c200; padding: 8px 12px; margin-bottom: 16px; font-weight: 700; }
  .honesty { font-size: 11px; color: #666; font-style: italic; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; vertical-align: top; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  table.sched th, table.sched td { padding: 4px 6px; border-bottom: 1px solid #eee; text-align: left; }
  table.sched th.amt, table.sched td.amt { text-align: right; }
  table.sched th { font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; }
  .total { font-weight: 700; font-size: 15px; }
  .notes { white-space: pre-wrap; border: 1px solid #ddd; padding: 10px; margin-top: 8px; }
  .sig { margin-top: 48px; display: flex; gap: 48px; }
  .sig div { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
  @media print { body { margin: 12mm; } .sample-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  ${banner}
  <h1>Bill of Sale</h1>
  <p class="meta">Date: ${esc(data.dealDate || new Date().toLocaleDateString("en-CA"))}</p>

  ${dealerBusinessBlock(data.dealer)}

  <h2>Vehicle</h2>
  <table>
    <tr><td>${esc(data.vehicleLabel || "—")}</td><td class="amt">VIN ${esc(data.vin || "—")}</td></tr>
    <tr><td>Stock</td><td class="amt">${esc(data.stockNumber || "—")}</td></tr>
  </table>

  <h2>Purchaser</h2>
  <table>
    <tr><td>${esc(data.customerName || "—")}</td></tr>
    ${data.customerAddress ? `<tr><td>${esc(data.customerAddress)}</td></tr>` : ""}
    <tr><td>Sale type: ${esc(data.saleType || "—")}</td></tr>
  </table>

  <h2>Pricing</h2>
  <table>
    <tr><td>Vehicle price</td><td class="amt">${money(data.priceVehicle)}</td></tr>
    <tr><td>Trade-in allowance</td><td class="amt">${money(data.tradeInAllowance)}</td></tr>
    <tr><td>GST / HST</td><td class="amt">${money(data.gstAmount)}</td></tr>
    <tr><td>PST</td><td class="amt">${money(data.pstAmount)}</td></tr>
    <tr><td>Deposit</td><td class="amt">${money(data.deposit)}</td></tr>
    <tr class="total"><td>Total purchase price</td><td class="amt">${money(data.totalPurchasePrice)}</td></tr>
    <tr class="total"><td>Balance due</td><td class="amt">${money(data.totalBalanceDue)}</td></tr>
    <tr><td>Payment status</td><td class="amt">${esc(data.paymentStatus || "—")}</td></tr>
  </table>

  ${financingBlock(data.financing)}

  ${disclosureSections.join("\n  ")}

  <div class="sig">
    <div>Purchaser signature</div>
    <div>Dealer signature</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

export function openBosPrintWindow(data: BosPdfPayload): void {
    const html = buildBosPrintHtml(data);
    // Do not pass noopener/noreferrer in windowFeatures — that makes window.open return null.
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
        throw new Error("Pop-up blocked — allow pop-ups to generate the Bill of Sale PDF.");
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.opener = null;
}
