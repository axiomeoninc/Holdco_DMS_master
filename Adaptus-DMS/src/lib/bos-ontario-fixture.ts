/**
 * Synthetic Ontario BOS PDF fixture — NOT real customers / VINs / Nova PII.
 * Used for Lane B PDF proof only. Do not insert into production tables.
 */

import type { BosPdfPayload } from "./bos-pdf";
import { buildBosPrintHtml } from "./bos-pdf";

export const BOS_ONTARIO_SAMPLE_BANNER =
    "SAMPLE / FIXTURE — not a live deal; no real customer or VIN";

/** UCDA-aligned demo payload for print/HTML proof. */
export const BOS_ONTARIO_SAMPLE_PAYLOAD: BosPdfPayload = {
    sampleBanner: BOS_ONTARIO_SAMPLE_BANNER,
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
    tradeInDisclosure: "Trade-in disclosure (fixture): odometer as stated; no warranty implied.",
};

export function buildBosOntarioSampleHtml(): string {
    return buildBosPrintHtml(BOS_ONTARIO_SAMPLE_PAYLOAD);
}
