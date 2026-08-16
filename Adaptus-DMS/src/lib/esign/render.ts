/**
 * Printable signature block + PDF composition for e-signatures.
 *
 * Two compositions are supported:
 *   1. `signatureBlockHtml` — a printable HTML fragment appended to the
 *      existing browser print-to-PDF documents (BOS/quotation/invoice).
 *   2. `appendSignaturePageToPdfBytes` — pdf-lib page appended to existing
 *      PDF bytes (used by the server-side signed-PDF endpoint).
 *
 * Wording is intentionally honest: it is an ELECTRONIC SIGNATURE record with a
 * typed name, initials and a consent timestamp — not a "wet signature".
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EsignRecord } from "./types";

function esc(s: unknown): string {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fmtTimestamp(iso: string): string {
    try {
        return new Date(iso).toLocaleString("en-CA", {
            timeZone: "UTC",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
        });
    } catch {
        return String(iso);
    }
}

function roleLabel(role: string): string {
    switch (role) {
        case "buyer":
            return "Buyer / Customer";
        case "seller":
            return "Seller / Dealership";
        case "manager":
            return "Dealership Manager";
        default:
            return role;
    }
}

function documentLabel(type: string): string {
    switch (type) {
        case "bill_of_sale":
            return "Bill of Sale";
        case "quotation":
            return "Quotation";
        case "we_owe":
            return "We Owe";
        case "invoice":
            return "Invoice";
        default:
            return type;
    }
}

/**
 * HTML signature block for print documents. Injected before </body>.
 */
export function signatureBlockHtml(sig: EsignRecord): string {
    return `
  <section class="esign-block" style="border:2px solid #111;margin-top:32px;padding:20px;">
    <h2 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Electronic Signature Record</h2>
    <p style="font-size:11px;line-height:1.5;margin:0 0 12px;">
      This ${esc(documentLabel(sig.document_type))} was signed electronically. By typing their name and
      initials and clicking "Agree and Sign", <strong>${esc(sig.signer_name)}</strong> confirmed they read and
      agreed to the terms of this document. An electronic signature is valid under applicable electronic
      transactions legislation (e.g., Ontario Electronic Commerce Act, 2000). This is not a wet signature.
    </p>
    <table style="width:100%;font-size:11px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#555;width:180px;">Signed by (typed name)</td><td style="padding:4px 0;font-weight:bold;">${esc(sig.signer_name)}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Initials</td><td style="padding:4px 0;font-weight:bold;">${esc(sig.signer_initials)}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Role</td><td style="padding:4px 0;">${esc(roleLabel(sig.signer_role))}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Date &amp; time (UTC)</td><td style="padding:4px 0;">${esc(fmtTimestamp(sig.consent_timestamp))}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Document</td><td style="padding:4px 0;">${esc(documentLabel(sig.document_type))} (${esc(sig.document_id)})</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Signature record ID</td><td style="padding:4px 0;">${esc(sig.id)}</td></tr>
    </table>
    <p style="font-size:10px;color:#555;margin:12px 0 0;border-top:1px solid #ddd;padding-top:8px;">
      Consent text: ${esc(sig.consent_text)}
    </p>
  </section>`;
}

/**
 * Inject a signature block into an existing print-HTML document (before </body>).
 * Returns the original HTML untouched if no </body> is found.
 */
export function injectSignatureBlockIntoPrintHtml(html: string, sig: EsignRecord): string {
    const block = signatureBlockHtml(sig);
    const idx = html.lastIndexOf("</body>");
    if (idx < 0) return html + block;
    return html.slice(0, idx) + block + html.slice(idx);
}

function drawWrappedText(
    page: { drawText: (text: string, opts: object) => void; getHeight: () => number; getWidth: () => number },
    text: string,
    font: object,
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
        if (test.length * size * 0.5 > maxWidth && line) {
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

/**
 * Append an ELECTRONIC SIGNATURE RECORD page to existing PDF bytes.
 * Loads the source PDF, adds one US-Letter page with the signature details,
 * and returns the new bytes. Used by the signed-PDF endpoint.
 */
export async function appendSignaturePageToPdfBytes(
    sourceBytes: Uint8Array,
    sig: EsignRecord
): Promise<Uint8Array> {
    const doc = await PDFDocument.load(sourceBytes);
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const black = rgb(0.07, 0.07, 0.07);
    const muted = rgb(0.42, 0.42, 0.42);
    const border = rgb(0.85, 0.85, 0.85);

    const margin = 48;
    const contentWidth = 612 - margin * 2;

    page.drawRectangle({
        x: margin - 12,
        y: 760 - 36,
        width: contentWidth + 24,
        height: 28,
        borderWidth: 2,
        borderColor: black,
    });
    page.drawText("ELECTRONIC SIGNATURE RECORD", {
        x: margin,
        y: 766,
        size: 11,
        font: bold,
        color: black,
    });

    let y = 710;
    y = drawWrappedText(
        page,
        `This ${documentLabel(sig.document_type)} was signed electronically. By typing their name and initials and clicking "Agree and Sign", ${sig.signer_name} confirmed they read and agreed to the terms of this document. An electronic signature is valid under applicable electronic transactions legislation (e.g., Ontario Electronic Commerce Act, 2000). This is not a wet signature.`,
        font,
        9,
        margin,
        y,
        contentWidth,
        14
    );

    y -= 18;
    page.drawText("Signature details", { x: margin, y, size: 10, font: bold, color: black });
    y -= 6;
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 0.6, color: border });
    y -= 20;

    const rows: Array<[string, string]> = [
        ["Signed by (typed name)", sig.signer_name],
        ["Initials", sig.signer_initials],
        ["Role", roleLabel(sig.signer_role)],
        ["Date & time (UTC)", fmtTimestamp(sig.consent_timestamp)],
        ["Document", `${documentLabel(sig.document_type)} (${sig.document_id})`],
        ["Signature record ID", sig.id],
        ["Recorded by (user id)", sig.created_by || "—"],
    ];
    for (const [label, value] of rows) {
        page.drawText(label, { x: margin, y, size: 9, font: bold, color: muted });
        page.drawText(String(value ?? ""), { x: margin + 170, y, size: 9, font, color: black });
        y -= 18;
    }

    y -= 16;
    page.drawText("Consent text accepted by signer:", {
        x: margin,
        y,
        size: 9,
        font: bold,
        color: muted,
    });
    y -= 14;
    y = drawWrappedText(page, sig.consent_text, font, 8, margin, y, contentWidth, 12);

    y -= 20;
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 0.6, color: border });
    y -= 14;
    page.drawText(
        "This record is part of the dealership's audit trail and is retained per the 10-year retention policy.",
        { x: margin, y, size: 8, font, color: muted }
    );

    const bytes = await doc.save();
    return new Uint8Array(bytes);
}
