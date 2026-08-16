#!/usr/bin/env node
/**
 * Write Ontario BOS sample HTML fixture (no DB writes, no real customers).
 * Run: node scripts/generate-bos-ontario-fixture.mjs
 *
 * Mirrors src/lib/bos-pdf.ts + bos-ontario-fixture.ts for offline proof.
 * Prefer regenerating after bos-pdf template changes, then re-check signoff path.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "migration", "_sync_audit", "fixtures");
const outHtml = path.join(outDir, "bos_ontario_sample.html");
const outJson = path.join(outDir, "bos_ontario_sample_payload.json");

const SAMPLE_BANNER =
    "SAMPLE / FIXTURE — not a live deal; no real customer or VIN";

const payload = {
    sampleBanner: SAMPLE_BANNER,
    dealDate: "2026-08-04",
    dealer: {
        name: "Sample Motors (Fixture)",
        business_name: "Sample Motors Ltd.",
        business_address: "100 Demo Street, Toronto, ON M5V 0AA",
        business_phone: "(416) 555-0100",
        business_email: "bos-fixture@example.invalid",
        dealer_license: "MVDA-SAMPLE-0000",
        hst_number: "123456789RT0001",
    },
    vehicleLabel: "2020 Sample Make Model",
    vin: "SAMPLEVIN000000001",
    stockNumber: "FIX-001",
    customerName: "Sample Purchaser (Fixture)",
    customerAddress: "200 Example Ave · Toronto, ON · M5H 0A0",
    saleType: "Retail",
    priceVehicle: 15995,
    tradeInAllowance: 2000,
    gstAmount: 1829.35,
    pstAmount: 0,
    deposit: 500,
    totalPurchasePrice: 15824.35,
    totalBalanceDue: 15324.35,
    paymentStatus: "Pending",
    notes: "Ontario MVDA disclosure (fixture): prior cosmetic repair disclosed for sample proof only.",
    tradeInDisclosure:
        "Trade-in disclosure (fixture): odometer as stated; no warranty implied.",
};

function money(n) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(Number(n) || 0);
}

function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildHtml(data) {
    const d = data.dealer;
    const taxBits = [];
    if (d.dealer_license) taxBits.push(`Dealer licence: ${esc(d.dealer_license)}`);
    if (d.hst_number) taxBits.push(`HST #: ${esc(d.hst_number)}`);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Bill of Sale — Ontario fixture sample</title>
<style>
  body { font-family: Georgia, serif; color: #111; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #444; margin-bottom: 12px; }
  .dealer-block { border: 1px solid #ddd; padding: 12px; background: #fafafa; }
  .sample-banner { background: #fff3cd; border: 1px solid #e6c200; padding: 8px 12px; margin-bottom: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; vertical-align: top; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .total { font-weight: 700; font-size: 15px; }
  .notes { white-space: pre-wrap; border: 1px solid #ddd; padding: 10px; margin-top: 8px; }
  .sig { margin-top: 48px; display: flex; gap: 48px; }
  .sig div { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
</style>
</head>
<body>
  <div class="sample-banner">${esc(data.sampleBanner)}</div>
  <h1>Bill of Sale</h1>
  <p class="meta">Date: ${esc(data.dealDate)}</p>
  <h2>Dealership</h2>
  <div class="meta dealer-block">
    <strong>${esc(d.business_name)}</strong>
    <p>${esc(d.business_address)}</p>
    <p>${esc(d.business_phone)} · ${esc(d.business_email)}</p>
    <p>${taxBits.join(" · ")}</p>
  </div>
  <h2>Vehicle</h2>
  <table>
    <tr><td>${esc(data.vehicleLabel)}</td><td class="amt">VIN ${esc(data.vin)}</td></tr>
    <tr><td>Stock</td><td class="amt">${esc(data.stockNumber)}</td></tr>
  </table>
  <h2>Purchaser</h2>
  <table>
    <tr><td>${esc(data.customerName)}</td></tr>
    <tr><td>${esc(data.customerAddress)}</td></tr>
    <tr><td>Sale type: ${esc(data.saleType)}</td></tr>
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
    <tr><td>Payment status</td><td class="amt">${esc(data.paymentStatus)}</td></tr>
  </table>
  <h2>Notes / disclosure</h2>
  <div class="notes">${esc(data.notes)}</div>
  <h2>Trade-in disclosure</h2>
  <div class="notes">${esc(data.tradeInDisclosure)}</div>
  <div class="sig">
    <div>Purchaser signature</div>
    <div>Dealer signature</div>
  </div>
</body>
</html>
`;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(payload, null, 2) + "\n", "utf8");
fs.writeFileSync(outHtml, buildHtml(payload), "utf8");

const html = fs.readFileSync(outHtml, "utf8");
const checks = [
    "Dealership",
    "HST #",
    "Dealer licence",
    "Notes / disclosure",
    "Trade-in disclosure",
    "SAMPLE / FIXTURE",
];
const missing = checks.filter((c) => !html.includes(c));
if (missing.length) {
    console.error("Fixture missing required sections:", missing);
    process.exit(1);
}

console.log("Wrote", path.relative(root, outHtml));
console.log("Wrote", path.relative(root, outJson));
console.log("Proof checks OK:", checks.join(", "));
