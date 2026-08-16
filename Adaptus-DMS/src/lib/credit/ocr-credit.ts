/**
 * Client-side OCR parsing for credit application documents (ID, paystub,
 * credit card statement). Reuses the regex approach from OCRScannerModal
 * (tesseract.js does the OCR; this module turns text into prefill fields).
 * No PII leaves the browser — prefill stays in the form state.
 */

export interface CreditOcrFields {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    email?: string;
    phone?: string;
    employer?: string;
    annual_income?: number;
    confidence?: number;
}

function normalizeDate(dateStr: string): string {
    const parts = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (parts) {
        let year = parseInt(parts[3]!, 10);
        if (year < 100) year += 2000;
        return `${year}-${parts[1]!.padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
    }
    return dateStr;
}

function parseMoney(text: string): number | undefined {
    const m = text.replace(/,/g, "").match(/\$?\s*(\d{3,})\b/);
    if (!m) return undefined;
    const n = parseInt(m[1]!, 10);
    return Number.isFinite(n) ? n : undefined;
}

/** Parse OCR text for an ID document (driver's licence / government ID). */
export function parseIdOcr(text: string): CreditOcrFields {
    const data: CreditOcrFields = {};
    const patterns: Array<[keyof CreditOcrFields, RegExp]> = [
        ["first_name", /(?:first\s*name|given\s*name)[:\s]*([A-Za-z]+)/i],
        ["last_name", /(?:last\s*name|surname|family\s*name)[:\s]*([A-Za-z]+)/i],
        [
            "date_of_birth",
            /(?:dob|date\s*of\s*birth|birth\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        ],
    ];
    for (const [key, re] of patterns) {
        const m = text.match(re);
        if (m) {
            (data as Record<string, string | undefined>)[key] =
                key === "date_of_birth" ? normalizeDate(m[1]!) : m[1]!;
        }
    }
    if (!data.first_name || !data.last_name) {
        const full = text.match(/(?:name|full\s*name)[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i);
        if (full) {
            const parts = full[1]!.split(/\s+/);
            if (!data.first_name && parts[0]) data.first_name = parts[0];
            if (!data.last_name && parts.length > 1) {
                data.last_name = parts[parts.length - 1];
            }
        }
    }
    for (const line of text.split("\n")) {
        if (line.match(/\d+\s+[A-Za-z]+\s+(st|street|ave|avenue|rd|road|dr|drive)/i)) {
            data.address = line.trim();
        }
        const cityMatch = line.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*)$/);
        if (cityMatch && !data.city && cityMatch[1]!.length < 30) {
            data.city = cityMatch[1];
        }
    }
    const provinceMatch = text.match(/\b(ON|BC|AB|SK|MB|QC|NS|NB|NL|PE|NT|NU|YT)\b/i);
    if (provinceMatch) data.province = provinceMatch[1]!.toUpperCase();
    const postalMatch = text.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);
    if (postalMatch) data.postal_code = postalMatch[1]!.toUpperCase();
    return data;
}

/** Parse OCR text for an income/employment document (paystub or tax slip). */
export function parseIncomeOcr(text: string): CreditOcrFields {
    const data: CreditOcrFields = {};
    const employerMatch = text.match(/(?:employer|company|business)[:\s]*([A-Za-z0-9&.\- ]{2,40})/i);
    if (employerMatch) data.employer = employerMatch[1]!.trim();
    const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    if (emailMatch) data.email = emailMatch[0];
    const phoneMatch = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (phoneMatch) data.phone = phoneMatch[0];

    // Year-to-date gross pay is the most reliable income anchor on a paystub.
    const ytdMatch = text.match(/year\s*to\s*date|ytd[:\s]*\$\s*([\d,]{5,})/i);
    if (ytdMatch) {
        const ytd = parseInt(ytdMatch[1]!.replace(/,/g, ""), 10);
        if (Number.isFinite(ytd) && ytd > 0) {
            // YTD / pay periods elapsed is unknowable — use YTD as a floor and
            // let the operator confirm. Conservative: assume YTD is ~1/12 of
            // annual income only when the paystub looks weekly (4+ ytd markers
            // absent). To stay honest, we surface YTD as a note, not a claim.
            data.annual_income = undefined;
            data.confidence = 30;
        }
    }
    const gross = text.match(/(?:gross|salary|wages?|income)[:\s]*\$?\s*([\d,]{4,})/i);
    if (gross) {
        const n = parseMoney(gross[0]!);
        if (n !== undefined) data.annual_income = n;
    }
    const amount = parseMoney(text);
    if (data.annual_income === undefined && amount !== undefined) {
        data.annual_income = amount;
    }
    return data;
}

export type CreditDocType = "drivers_license" | "government_id" | "paystub" | "income_doc";

/** Route raw OCR text to the right parser. */
export function parseCreditDocOcr(text: string, docType: CreditDocType): CreditOcrFields {
    if (docType === "paystub" || docType === "income_doc") {
        return parseIncomeOcr(text);
    }
    return parseIdOcr(text);
}

/** Merge OCR fields into an existing form state without overwriting user edits. */
export function mergePrefill<T extends object>(
    form: T,
    ocr: CreditOcrFields
): T {
    const next = { ...form };
    for (const [key, value] of Object.entries(ocr)) {
        if (value === undefined || value === null || value === "") continue;
        const current = (form as Record<string, unknown>)[key];
        if (current === undefined || current === null || current === "") {
            (next as Record<string, unknown>)[key] = value;
        }
    }
    return next;
}
