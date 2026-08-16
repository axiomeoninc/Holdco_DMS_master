/**
 * pdf-lib invoice writer. Import from server routes or via dynamic import
 * inside a click handler — never statically from a "use client" module.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
    formatInvoiceCad,
    formatInvoiceDate,
    normalizeInvoiceDocument,
    type InvoicePdfPayload,
} from "./invoice-pdf";

function drawText(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    color = rgb(0.07, 0.07, 0.07)
): void {
    page.drawText(text, { x, y, size, font, color });
}

function truncateToWidth(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number
): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
        t = t.slice(0, -1);
    }
    return `${t}…`;
}

/** True downloadable PDF bytes (letter, CAD layout). Safe on CF Workers. */
export async function buildInvoicePdfBytes(
    raw: InvoicePdfPayload
): Promise<Uint8Array> {
    const data = normalizeInvoiceDocument(raw);
    const balance = Math.max(
        0,
        (Number(data.total) || 0) - (Number(data.amountPaid) || 0)
    );
    const lineItems = data.lineItems || [];

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
    const page = doc.addPage([612, 792]); // US Letter
    const { width, height } = page.getSize();
    const margin = 48;
    let y = height - margin;

    const stamp = data.statusStamp || "PENDING";
    drawText(page, `Invoice ${data.invoiceNumber}`, margin, y, fontBold, 20);
    const stampWidth = fontBold.widthOfTextAtSize(stamp, 10);
    drawText(page, stamp, width - margin - stampWidth, y + 4, fontBold, 10, rgb(0.3, 0.3, 0.3));
    y -= 22;

    drawText(
        page,
        `Date: ${formatInvoiceDate(data.invoiceDate)}  ·  Due: ${formatInvoiceDate(data.dueDate)}`,
        margin,
        y,
        font,
        10,
        rgb(0.35, 0.35, 0.35)
    );
    y -= 28;

    const col2 = width / 2 + 8;
    const dealerLines: string[] = [];
    if (data.dealerName?.trim()) dealerLines.push(data.dealerName.trim());
    if (data.dealerAddress?.trim()) dealerLines.push(data.dealerAddress.trim());
    const dealerContact = [data.dealerPhone, data.dealerEmail]
        .filter((x) => Boolean(x && String(x).trim()))
        .join(" · ");
    if (dealerContact) dealerLines.push(dealerContact);
    const taxBits: string[] = [];
    if (data.dealerLicence?.trim()) taxBits.push(`Licence: ${data.dealerLicence.trim()}`);
    if (data.dealerHst?.trim()) taxBits.push(`HST #: ${data.dealerHst.trim()}`);
    if (taxBits.length) dealerLines.push(taxBits.join(" · "));
    if (dealerLines.length === 0) dealerLines.push("Dealership");

    const custLines: string[] = [];
    custLines.push(data.customerName?.trim() || "Customer");
    if (data.customerAddress?.trim()) custLines.push(data.customerAddress.trim());
    const custContact = [data.customerPhone, data.customerEmail]
        .filter((x) => Boolean(x && String(x).trim()))
        .join(" · ");
    if (custContact) custLines.push(custContact);

    drawText(page, "From", margin, y, fontBold, 9, rgb(0.4, 0.4, 0.4));
    drawText(page, "Bill to", col2, y, fontBold, 9, rgb(0.4, 0.4, 0.4));
    y -= 14;

    const maxRows = Math.max(dealerLines.length, custLines.length);
    for (let i = 0; i < maxRows; i++) {
        const left = dealerLines[i];
        const right = custLines[i];
        if (left) {
            drawText(
                page,
                truncateToWidth(left, i === 0 ? fontBold : font, 10, width / 2 - margin - 16),
                margin,
                y,
                i === 0 ? fontBold : font,
                10
            );
        }
        if (right) {
            drawText(
                page,
                truncateToWidth(right, i === 0 ? fontBold : font, 10, width / 2 - margin - 16),
                col2,
                y,
                i === 0 ? fontBold : font,
                10
            );
        }
        y -= 13;
    }
    y -= 16;

    drawText(page, "Charges", margin, y, fontBold, 12);
    y -= 8;
    page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;

    const descX = margin;
    const qtyX = 360;
    const unitX = 420;
    const amtX = width - margin;

    drawText(page, "Description", descX, y, fontBold, 9, rgb(0.4, 0.4, 0.4));
    drawText(page, "Qty", qtyX, y, fontBold, 9, rgb(0.4, 0.4, 0.4));
    drawText(page, "Unit", unitX, y, fontBold, 9, rgb(0.4, 0.4, 0.4));
    const amtHdr = "Amount";
    drawText(
        page,
        amtHdr,
        amtX - fontBold.widthOfTextAtSize(amtHdr, 9),
        y,
        fontBold,
        9,
        rgb(0.4, 0.4, 0.4)
    );
    y -= 14;

    for (const li of lineItems) {
        if (y < 120) break;
        const desc = truncateToWidth(li.description, font, 10, qtyX - descX - 12);
        drawText(page, desc, descX, y, font, 10);
        const qtyStr = String(li.qty);
        drawText(page, qtyStr, qtyX, y, font, 10);
        const unitStr = formatInvoiceCad(li.unitPrice);
        drawText(page, unitStr, unitX, y, font, 10);
        const amtStr = formatInvoiceCad(li.amount);
        drawText(page, amtStr, amtX - font.widthOfTextAtSize(amtStr, 10), y, font, 10);
        y -= 14;
    }

    y -= 6;
    const taxLabel = `Tax (${Number(data.taxRate) || 0}%)`;
    drawText(page, taxLabel, descX, y, font, 10);
    const taxStr = formatInvoiceCad(data.taxAmount);
    drawText(page, taxStr, amtX - font.widthOfTextAtSize(taxStr, 10), y, font, 10);
    y -= 20;

    const totals: Array<{ label: string; value: string; bold?: boolean }> = [
        { label: "Subtotal", value: formatInvoiceCad(data.subtotal) },
        { label: "Total", value: formatInvoiceCad(data.total), bold: true },
        { label: "Amount paid", value: formatInvoiceCad(data.amountPaid) },
        { label: "Balance due", value: formatInvoiceCad(balance), bold: true },
    ];
    for (const row of totals) {
        const f = row.bold ? fontBold : font;
        drawText(page, row.label, unitX - 40, y, f, 11);
        drawText(
            page,
            row.value,
            amtX - f.widthOfTextAtSize(row.value, 11),
            y,
            f,
            11
        );
        y -= 15;
    }

    if (data.payments && data.payments.length > 0 && y > 160) {
        y -= 10;
        drawText(page, "Payment ledger", margin, y, fontBold, 12);
        y -= 8;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 0.5,
            color: rgb(0.7, 0.7, 0.7),
        });
        y -= 14;
        for (const p of data.payments.slice(0, 8)) {
            if (y < 100) break;
            const line = `${formatInvoiceDate(p.date)}  ${p.method || "—"}  ${formatInvoiceCad(p.amount)}${p.note ? `  — ${p.note}` : ""}`;
            drawText(
                page,
                truncateToWidth(line, font, 9, width - margin * 2),
                margin,
                y,
                font,
                9
            );
            y -= 12;
        }
    }

    const footer =
        data.paymentInstructions?.trim() ||
        "Thank you for your business. Contact the dealership with payment questions.";
    y = Math.min(y - 20, 72);
    page.drawLine({
        start: { x: margin, y: y + 12 },
        end: { x: width - margin, y: y + 12 },
        thickness: 0.5,
        color: rgb(0.75, 0.75, 0.75),
    });
    drawText(
        page,
        truncateToWidth(footer, font, 9, width - margin * 2),
        margin,
        y,
        font,
        9,
        rgb(0.35, 0.35, 0.35)
    );

    return doc.save();
}
