/**
 * Compliance document pack — We Owe, Buyer's Guide, Known-Damage Disclosure.
 *
 * Generated with pdf-lib (standard fonts, US-Letter). Each document is a
 * straightforward, honest disclosure form. The pack can be downloaded as a
 * single PDF from the retention/compliance page.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ComplianceDocType = "we_owe" | "buyers_guide" | "known_damage";

export interface ComplianceDealer {
    name?: string | null;
    business_name?: string | null;
    business_address?: string | null;
    business_phone?: string | null;
    dealer_license?: string | null;
}

export interface WeOweInput {
    dealer?: ComplianceDealer | null;
    customerName?: string | null;
    vehicleLabel?: string | null;
    vin?: string | null;
    tradeInVin?: string | null;
    items: string[];
    notes?: string | null;
    date?: string | null;
}

export interface BuyersGuideInput {
    dealer?: ComplianceDealer | null;
    vehicleLabel?: string | null;
    vin?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    warrantyOption?: "AS-IS" | "limited" | "full" | null;
    warrantyDescription?: string | null;
    odometer?: number | null;
    date?: string | null;
}

export interface KnownDamageInput {
    dealer?: ComplianceDealer | null;
    vehicleLabel?: string | null;
    vin?: string | null;
    disclosure: string;
    notes?: string | null;
    date?: string | null;
}

const MARGIN = 48;
const CONTENT_WIDTH = 612 - MARGIN * 2;

function dealerName(d: ComplianceDealer | null | undefined): string {
    return d?.business_name?.trim() || d?.name?.trim() || "Dealership";
}

function fmtDate(d: string | null | undefined): string {
    if (!d) return new Date().toISOString().split("T")[0] ?? "";
    const s = String(d);
    return s.includes("T") ? s.split("T")[0]! : s;
}

function wrapText(
    page: PDFPage,
    text: string,
    font: PDFFont,
    size: number,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number
): number {
    let y = startY;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(test, size);
        if (width > maxWidth && line) {
            page.drawText(line, { x, y, size, font });
            y -= lineHeight;
            line = word;
        } else {
            line = test;
        }
    }
    if (line) {
        page.drawText(line, { x, y, size, font });
        y -= lineHeight;
    }
    return y;
}

function makeDoc(): Promise<PDFDocument> {
    return PDFDocument.create();
}

async function header(
    doc: PDFDocument,
    title: string,
    subtitle: string
): Promise<{ page: PDFPage; font: PDFFont; bold: PDFFont; y: number }> {
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const mutedColor = rgb(0.42, 0.42, 0.42);

    page.drawText(title, { x: MARGIN, y: 740, size: 16, font: bold, color: rgb(0.07, 0.07, 0.07) });
    page.drawText(subtitle, { x: MARGIN, y: 722, size: 9, font, color: mutedColor });
    page.drawRectangle({ x: MARGIN, y: 712, width: CONTENT_WIDTH, height: 0.8, color: rgb(0.85, 0.85, 0.85) });
    return { page, font, bold, y: 690 };
}

async function footer(doc: PDFDocument, page: PDFPage, note: string): Promise<void> {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(note, { x: MARGIN, y: 44, size: 7.5, font, color: rgb(0.55, 0.55, 0.55) });
}

function drawDealerBlock(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    dealer: ComplianceDealer | null | undefined,
    y: number
): number {
    const lines: Array<[string, string]> = [
        ["Dealership", dealerName(dealer)],
        ["Address", dealer?.business_address?.trim() || "—"],
        ["Phone", dealer?.business_phone?.trim() || "—"],
        ["Dealer licence", dealer?.dealer_license?.trim() || "—"],
    ];
    for (const [label, value] of lines) {
        page.drawText(label, { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(value, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }
    return y - 6;
}

/** We Owe — a promise to provide something after sale (e.g. second key). */
export async function buildWeOwePdfBytes(input: WeOweInput): Promise<Uint8Array> {
    const doc = await makeDoc();
    const { page, font, bold } = await header(doc, "WE OWE", `Issued ${fmtDate(input.date)} · Recorded in FlashFender`);
    let y = await drawDealerBlock(page, font, bold, input.dealer, 690);

    if (input.customerName) {
        page.drawText("Customer", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(input.customerName, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }
    if (input.vehicleLabel) {
        page.drawText("Vehicle", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(input.vehicleLabel, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }
    if (input.vin) {
        page.drawText("VIN", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(input.vin, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }
    if (input.tradeInVin) {
        page.drawText("Trade-in VIN", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(input.tradeInVin, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }

    y -= 14;
    page.drawText("The dealership owes the following:", { x: MARGIN, y, size: 10, font: bold });
    y -= 16;
    const items = input.items.length ? input.items : ["(no items recorded)"];
    for (const item of items) {
        page.drawText(`• ${item}`, { x: MARGIN, y, size: 9, font });
        y -= 15;
    }

    if (input.notes?.trim()) {
        y -= 10;
        page.drawText("Notes", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        y -= 14;
        y = wrapText(page, input.notes.trim(), font, 8.5, MARGIN, y, CONTENT_WIDTH, 13);
    }

    y -= 22;
    page.drawText("Buyer acknowledgement", { x: MARGIN, y, size: 9, font: bold });
    y -= 14;
    y = wrapText(
        page,
        "I acknowledge receipt of this We Owe. The dealership will complete the listed item(s) as promised.",
        font,
        8.5,
        MARGIN,
        y,
        CONTENT_WIDTH,
        13
    );
    y -= 10;
    page.drawText("Buyer signature: ____________________________      Date: ____________", { x: MARGIN, y, size: 9, font });

    await footer(doc, page, "Generated by FlashFender. This is a dealer-issued We Owe form, not a legal opinion.");
    const bytes = await doc.save();
    return new Uint8Array(bytes);
}

/** Buyer's Guide — used-vehicle disclosure (similar in spirit to OMVIC/FTC). */
export async function buildBuyersGuidePdfBytes(input: BuyersGuideInput): Promise<Uint8Array> {
    const doc = await makeDoc();
    const { page, font, bold } = await header(doc, "BUYER'S GUIDE", `Issued ${fmtDate(input.date)}`);
    let y = await drawDealerBlock(page, font, bold, input.dealer, 690);

    const vehLabel =
        input.vehicleLabel ||
        [input.year, input.make, input.model].filter(Boolean).join(" ") ||
        "Vehicle";
    const rows: Array<[string, string]> = [
        ["Vehicle", vehLabel],
        ["VIN", input.vin || "—"],
        ["Odometer", input.odometer != null ? String(input.odometer) : "—"],
        [
            "Warranty",
            input.warrantyOption === "AS-IS" ? "AS-IS — NO WARRANTY" : input.warrantyOption || "AS-IS",
        ],
    ];
    for (const [label, value] of rows) {
        page.drawText(label, { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(value, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }

    y -= 10;
    page.drawText("Warranty details", { x: MARGIN, y, size: 9, font: bold });
    y -= 14;
    y = wrapText(
        page,
        input.warrantyDescription?.trim() ||
            "No warranty is provided. The vehicle is sold as-is with no dealer warranty unless otherwise stated in writing.",
        font,
        8.5,
        MARGIN,
        y,
        CONTENT_WIDTH,
        13
    );

    y -= 22;
    page.drawText("Buyer acknowledgement", { x: MARGIN, y, size: 9, font: bold });
    y -= 14;
    y = wrapText(
        page,
        "I acknowledge that I have received this Buyer's Guide and understand the warranty status of the vehicle described above.",
        font,
        8.5,
        MARGIN,
        y,
        CONTENT_WIDTH,
        13
    );
    y -= 10;
    page.drawText("Buyer signature: ____________________________      Date: ____________", { x: MARGIN, y, size: 9, font });

    await footer(doc, page, "Generated by FlashFender. Buyer's Guide disclosure for used-vehicle sales.");
    const bytes = await doc.save();
    return new Uint8Array(bytes);
}

/** Known-damage disclosure (MVDA) — mirrors src/lib/mvda-damage.ts rules. */
export async function buildKnownDamageDisclosurePdfBytes(input: KnownDamageInput): Promise<Uint8Array> {
    const doc = await makeDoc();
    const { page, font, bold } = await header(doc, "KNOWN DAMAGE DISCLOSURE", `Issued ${fmtDate(input.date)}`);
    let y = await drawDealerBlock(page, font, bold, input.dealer, 690);

    if (input.vehicleLabel) {
        page.drawText("Vehicle", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(input.vehicleLabel, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }
    if (input.vin) {
        page.drawText("VIN", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(input.vin, { x: MARGIN + 120, y, size: 8.5, font });
        y -= 15;
    }

    y -= 14;
    page.drawText("Disclosed damage (as recorded by the dealership):", { x: MARGIN, y, size: 10, font: bold });
    y -= 16;
    y = wrapText(page, input.disclosure, font, 9, MARGIN, y, CONTENT_WIDTH, 15);

    if (input.notes?.trim()) {
        y -= 12;
        page.drawText("Notes", { x: MARGIN, y, size: 8.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
        y -= 14;
        y = wrapText(page, input.notes.trim(), font, 8.5, MARGIN, y, CONTENT_WIDTH, 13);
    }

    y -= 22;
    page.drawText("Buyer acknowledgement", { x: MARGIN, y, size: 9, font: bold });
    y -= 14;
    y = wrapText(
        page,
        "I acknowledge that the damage described above was disclosed to me before purchase.",
        font,
        8.5,
        MARGIN,
        y,
        CONTENT_WIDTH,
        13
    );
    y -= 10;
    page.drawText("Buyer signature: ____________________________      Date: ____________", { x: MARGIN, y, size: 9, font });

    await footer(doc, page, "Generated by FlashFender. MVDA-style known-damage disclosure.");
    const bytes = await doc.save();
    return new Uint8Array(bytes);
}

/** Combine documents into a single pack PDF. */
export async function buildCompliancePackPdfBytes(
    docs: Array<{ type: ComplianceDocType; bytes: Uint8Array }>
): Promise<Uint8Array> {
    const out = await PDFDocument.create();
    for (const { bytes } of docs) {
        const src = await PDFDocument.load(bytes);
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const page of pages) out.addPage(page);
    }
    return new Uint8Array(await out.save());
}
