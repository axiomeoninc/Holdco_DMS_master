/**
 * pdf-lib quotation writer. Import from server routes or via dynamic import
 * inside a click handler — never statically from a "use client" module.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
    dealerDisplayName,
    formatQuotationCad,
    formatQuotationDate,
    resolveFinanced,
    resolveTaxAmount,
    type QuotationPdfPayload,
} from "./quotation-pdf";

export async function buildQuotationPdfBytes(
    data: QuotationPdfPayload
): Promise<Uint8Array> {
    const taxAmount = resolveTaxAmount(data);
    const financed = resolveFinanced(data);
    const quoteLabel = data.quoteNumber?.trim() || "Quotation";

    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]); // US Letter
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0.07, 0.07, 0.07);
    const muted = rgb(0.4, 0.4, 0.4);
    const line = rgb(0.82, 0.82, 0.82);

    const margin = 48;
    const pageWidth = 612;
    const contentWidth = pageWidth - margin * 2;
    let y = 744;

    const drawText = (
        text: string,
        x: number,
        yy: number,
        size: number,
        f = font,
        color = black
    ) => {
        page.drawText(text, { x, y: yy, size, font: f, color });
    };

    const drawRight = (
        text: string,
        rightX: number,
        yy: number,
        size: number,
        f = font,
        color = black
    ) => {
        const w = f.widthOfTextAtSize(text, size);
        page.drawText(text, { x: rightX - w, y: yy, size, font: f, color });
    };

    const ensureSpace = (need: number) => {
        if (y - need < 48) {
            // Single-page quotes are expected; clip gracefully rather than multi-page complexity.
            y = 48;
        }
    };

    drawText(`Quotation ${quoteLabel}`, margin, y, 18, bold);
    y -= 18;
    const metaParts = [
        `Date: ${formatQuotationDate(data.createdAt)}`,
        `Valid until: ${formatQuotationDate(data.validUntil)}`,
        data.status ? `Status: ${data.status}` : null,
    ].filter(Boolean);
    drawText(metaParts.join("  ·  "), margin, y, 9, font, muted);
    y -= 20;

    page.drawLine({
        start: { x: margin, y },
        end: { x: margin + contentWidth, y },
        thickness: 1,
        color: line,
    });
    y -= 16;

    const colMid = margin + contentWidth / 2 + 8;
    const dealerName = dealerDisplayName(data.dealer);
    drawText("Dealership", margin, y, 9, bold, muted);
    drawText("Customer", colMid, y, 9, bold, muted);
    y -= 14;
    drawText(dealerName, margin, y, 11, bold);
    drawText(data.customerName?.trim() || "—", colMid, y, 11, bold);
    y -= 13;

    const leftExtras: string[] = [];
    if (data.dealer?.business_address?.trim()) {
        leftExtras.push(data.dealer.business_address.trim());
    }
    const dealerContact = [data.dealer?.business_phone, data.dealer?.business_email]
        .filter((x) => Boolean(x && String(x).trim()))
        .join(" · ");
    if (dealerContact) leftExtras.push(dealerContact);
    const taxBits: string[] = [];
    if (data.dealer?.dealer_license?.trim()) {
        taxBits.push(`Licence: ${data.dealer.dealer_license.trim()}`);
    }
    if (data.dealer?.hst_number?.trim()) {
        taxBits.push(`HST #: ${data.dealer.hst_number.trim()}`);
    }
    if (taxBits.length) leftExtras.push(taxBits.join(" · "));

    const rightExtras: string[] = [];
    if (data.customerPhone) rightExtras.push(String(data.customerPhone));
    if (data.customerEmail) rightExtras.push(String(data.customerEmail));

    const maxExtra = Math.max(leftExtras.length, rightExtras.length, 1);
    for (let i = 0; i < maxExtra; i++) {
        if (leftExtras[i]) drawText(leftExtras[i], margin, y, 9, font, muted);
        if (rightExtras[i]) drawText(rightExtras[i], colMid, y, 9, font, muted);
        y -= 12;
    }
    y -= 8;

    drawText("Vehicle", margin, y, 11, bold);
    y -= 14;
    drawText(data.vehicleLabel?.trim() || "—", margin, y, 10);
    drawRight(`VIN ${data.vin?.trim() || "—"}`, margin + contentWidth, y, 9, font, muted);
    y -= 13;
    if (data.stockNumber?.trim()) {
        drawText(`Stock ${data.stockNumber.trim()}`, margin, y, 9, font, muted);
        y -= 13;
    }
    y -= 6;

    drawText("Pricing", margin, y, 11, bold);
    y -= 4;
    page.drawLine({
        start: { x: margin, y },
        end: { x: margin + contentWidth, y },
        thickness: 0.5,
        color: line,
    });
    y -= 14;

    const rows: Array<[string, string, boolean?]> = [
        ["Sale price", formatQuotationCad(data.salePrice)],
        [`Tax (${Number(data.taxRate) || 0}%)`, formatQuotationCad(taxAmount)],
        ["Admin fee", formatQuotationCad(data.adminFee)],
        ["Trade-in", formatQuotationCad(data.tradeInValue)],
        ["Down payment", formatQuotationCad(data.downPayment)],
        ["Amount financed", formatQuotationCad(financed), true],
    ];
    if (data.interestRate != null) {
        rows.push(["Rate", `${Number(data.interestRate)}%`]);
    }
    if (data.financeTerm != null) {
        rows.push(["Term", `${Number(data.financeTerm)} months`]);
    }
    if (data.financeCompany?.trim()) {
        rows.push(["Finance company", data.financeCompany.trim()]);
    }
    if (data.monthlyPayment != null) {
        rows.push(["Est. monthly payment", formatQuotationCad(data.monthlyPayment), true]);
    }

    for (const [label, value, strong] of rows) {
        ensureSpace(16);
        drawText(label, margin, y, strong ? 10 : 9, strong ? bold : font);
        drawRight(
            value,
            margin + contentWidth,
            y,
            strong ? 10 : 9,
            strong ? bold : font
        );
        y -= 14;
    }

    if (data.notes?.trim()) {
        y -= 8;
        ensureSpace(40);
        drawText("Notes", margin, y, 11, bold);
        y -= 14;
        const note = data.notes.trim();
        const maxChars = 90;
        for (let i = 0; i < note.length; i += maxChars) {
            ensureSpace(14);
            drawText(note.slice(i, i + maxChars), margin, y, 9, font, muted);
            y -= 12;
        }
    }

    y -= 16;
    ensureSpace(48);
    page.drawRectangle({
        x: margin,
        y: y - 36,
        width: contentWidth,
        height: 44,
        borderColor: rgb(0.9, 0.76, 0.2),
        borderWidth: 1,
        color: rgb(1, 0.98, 0.9),
    });
    const disclaimer =
        "Estimate only — not a binding offer. Subject to lender approval and disclosure. Not an MVDA/UCDA certified form.";
    drawText(disclaimer, margin + 8, y - 12, 8, font, rgb(0.4, 0.3, 0.05));
    drawText(
        "Generated by AdaptUs DMS",
        margin + 8,
        y - 26,
        8,
        font,
        muted
    );

    return doc.save();
}
