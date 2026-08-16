// app/api/esign/signed-pdf/route.ts
// GET ?document_type=&document_id= — build a signed PDF:
//   quotation/invoice: existing pdf-lib document + appended signature record page
//   bill_of_sale:     server-side BOS summary + appended signature record page
//   we_owe:           We Owe compliance form + appended signature record page
// Requires at least one recorded signature on the document.

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    assertOwnershipOrDeny,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { appendSignaturePageToPdfBytes } from "@/src/lib/esign";
import type { EsignRecord } from "@/src/lib/esign";
import { buildWeOwePdfBytes } from "@/src/lib/audit";

type Supabase = typeof supabaseAdmin;

function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number): string {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

/** Build a compact Bill of Sale summary PDF with pdf-lib. */
async function buildBosSummaryPdf(
    bos: {
        buyer_name?: string | null;
        vehicle_description?: string | null;
        vin?: string | null;
        year?: number | null;
        make?: string | null;
        model?: string | null;
        sale_date?: string | null;
        sale_price?: number | null;
        tax_amount?: number | null;
        total_amount?: number | null;
        odometer?: number | null;
        deposit?: number | null;
        seller_name?: string | null;
    },
    dealershipName: string | null
): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const muted = rgb(0.42, 0.42, 0.42);
    const black = rgb(0.07, 0.07, 0.07);

    const margin = 48;
    page.drawText("BILL OF SALE", { x: margin, y: 740, size: 16, font: bold, color: black });
    page.drawText(dealershipName || "Dealership", { x: margin, y: 722, size: 9, font, color: muted });
    page.drawRectangle({ x: margin, y: 712, width: 612 - margin * 2, height: 0.8, color: rgb(0.85, 0.85, 0.85) });

    const rows: Array<[string, string]> = [
        ["Buyer", bos.buyer_name || "—"],
        ["Vehicle", bos.vehicle_description || [bos.year, bos.make, bos.model].filter(Boolean).join(" ") || "—"],
        ["VIN", bos.vin || "—"],
        ["Odometer", bos.odometer != null ? String(bos.odometer) : "—"],
        ["Sale date", bos.sale_date || "—"],
        ["Sale price", fmtMoney(num(bos.sale_price))],
        ["Tax", fmtMoney(num(bos.tax_amount))],
        ["Total", fmtMoney(num(bos.total_amount))],
        ["Deposit", fmtMoney(num(bos.deposit))],
        ["Seller", bos.seller_name || "—"],
    ];

    let y = 680;
    for (const [label, value] of rows) {
        page.drawText(label, { x: margin, y, size: 9, font: bold, color: muted });
        page.drawText(value, { x: margin + 140, y, size: 9, font, color: black });
        y -= 18;
    }

    y -= 14;
    page.drawText(
        "This summary accompanies the electronic signature record. The full signed bill of sale\n" +
            "is retained in the dealership's records and audit trail.",
        { x: margin, y, size: 8, font, color: muted, lineHeight: 12 }
    );

    const bytes = await doc.save();
    return new Uint8Array(bytes);
}

async function fetchSignatures(
    supabase: Supabase,
    dealershipId: string | null,
    documentType: string,
    documentId: string
): Promise<EsignRecord[]> {
    let q = supabase
        .from("esign_signatures")
        .select("*")
        .eq("document_type", documentType)
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });
    if (dealershipId) q = q.eq("dealership_id", dealershipId);
    const { data } = await q;
    return (data || []) as EsignRecord[];
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const url = new URL(req.url);
        const documentType = url.searchParams.get("document_type");
        const documentId = url.searchParams.get("document_id");

        if (!documentType || !documentId) {
            return NextResponse.json(
                { error: "document_type and document_id are required" },
                { status: 400 }
            );
        }

        const supabase = supabaseAdmin;
        const dealershipId = auth.profile.dealership_id;

        // Dealership display name for document headers.
        let dealershipName: string | null = null;
        if (dealershipId) {
            const { data: dealershipRow } = await supabase
                .from("dealerships")
                .select("name, business_name")
                .eq("id", dealershipId)
                .single();
            dealershipName =
                dealershipRow?.business_name?.trim() ||
                dealershipRow?.name ||
                null;
        }

        const signatures = await fetchSignatures(supabase, dealershipId, documentType, documentId);
        if (signatures.length === 0) {
            return NextResponse.json(
                { error: "No signature on file for this document — sign it first" },
                { status: 409 }
            );
        }

        let baseBytes: Uint8Array | null = null;
        let fallbackName = "signed-document";

        if (documentType === "quotation") {
            const { data, error } = await supabase
                .from("quotations")
                .select(
                    "id, dealership_id, quote_number, status, created_at, valid_until, notes, sale_price, down_payment, trade_in_value, tax_rate, admin_fee, monthly_payment, finance_term, interest_rate, finance_company, customer:customers(id, name, email, phone), vehicle:vehicles(id, make, model, year, vin, stock_number)"
                )
                .eq("id", documentId)
                .single();
            if (error) throw error;
            const deny = assertOwnershipOrDeny(data, auth.profile);
            if (deny) return deny;
            const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
            const vehicle = Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle;
            const { buildQuotationPdfBytes } = await import("@/src/lib/quotation-pdf");
            baseBytes = await buildQuotationPdfBytes({
                quoteNumber: data.quote_number,
                status: data.status,
                createdAt: data.created_at,
                validUntil: data.valid_until,
                notes: data.notes,
                customerName: customer?.name || null,
                customerEmail: customer?.email || null,
                customerPhone: customer?.phone || null,
                vehicleLabel: [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
                vin: vehicle?.vin || null,
                stockNumber: vehicle?.stock_number || null,
                salePrice: num(data.sale_price),
                downPayment: data.down_payment,
                tradeInValue: data.trade_in_value,
                taxRate: data.tax_rate,
                adminFee: data.admin_fee,
                monthlyPayment: data.monthly_payment,
                financeTerm: data.finance_term,
                interestRate: data.interest_rate,
                financeCompany: data.finance_company,
                dealer: { name: dealershipName, business_name: dealershipName },
            });
            fallbackName = `Quotation-${data.quote_number || documentId.slice(0, 8)}`;
        } else if (documentType === "invoice") {
            const { data, error } = await supabase
                .from("invoices")
                .select(
                    "id, dealership_id, invoice_number, invoice_date, due_date, status, total, tax_amount, tax_rate, payment_amount, amount_paid, notes, package_name, line_items, customer:customers(id, name, email, phone)"
                )
                .eq("id", documentId)
                .single();
            if (error) throw error;
            const deny = assertOwnershipOrDeny(data, auth.profile);
            if (deny) return deny;
            const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
            const { buildInvoicePdfBytes } = await import("@/src/lib/invoice-pdf");
            baseBytes = await buildInvoicePdfBytes({
                invoiceNumber: data.invoice_number || `INV-${documentId.slice(0, 8)}`,
                status: data.status,
                invoiceDate: data.invoice_date,
                dueDate: data.due_date,
                customerName: customer?.name || null,
                customerEmail: customer?.email || null,
                customerPhone: customer?.phone || null,
                customerAddress: null,
                subtotal: num(data.total) - num(data.tax_amount),
                taxRate: num(data.tax_rate) || 0,
                taxAmount: num(data.tax_amount),
                total: num(data.total),
                amountPaid: num(data.amount_paid),
                lineItems: data.line_items,
                packageName: data.package_name,
                notes: data.notes,
                dealerName: dealershipName,
            });
            fallbackName = `Invoice-${data.invoice_number || documentId.slice(0, 8)}`;
        } else if (documentType === "bill_of_sale") {
            const { data, error } = await supabase
                .from("bill_of_sale")
                .select(
                    "id, dealership_id, buyer_name, seller_name, vehicle_description, vin, year, make, model, sale_date, sale_price, tax_amount, total_amount, odometer, deposit"
                )
                .eq("id", documentId)
                .single();
            if (error) throw error;
            const deny = assertOwnershipOrDeny(data, auth.profile);
            if (deny) return deny;
            baseBytes = await buildBosSummaryPdf(data, dealershipName);
            fallbackName = `Bill-of-Sale-${documentId.slice(0, 8)}`;
        } else if (documentType === "we_owe") {
            // we_owe documents ride on a bill_of_sale record (document_id = BOS id).
            const { data, error } = await supabase
                .from("bill_of_sale")
                .select(
                    "id, dealership_id, buyer_name, vehicle_description, vin, sale_date, notes, trade_in_vin, vehicle:vehicles(make, model, year)"
                )
                .eq("id", documentId)
                .single();
            if (error) throw error;
            const deny = assertOwnershipOrDeny(data, auth.profile);
            if (deny) return deny;
            baseBytes = await buildWeOwePdfBytes({
                dealer: { name: dealershipName, business_name: dealershipName },
                customerName: data.buyer_name,
                vehicleLabel: data.vehicle_description,
                vin: data.vin,
                tradeInVin: data.trade_in_vin || null,
                items: ["(we-owe items listed on the original bill of sale)"],
                notes: data.notes,
                date: data.sale_date,
            });
            fallbackName = `We-Owe-${documentId.slice(0, 8)}`;
        } else {
            return NextResponse.json({ error: "Unsupported document_type" }, { status: 400 });
        }

        if (!baseBytes) {
            return NextResponse.json({ error: "Could not build the document" }, { status: 500 });
        }

        // Append the signature record page (last signature = latest).
        const latest = signatures[signatures.length - 1]!;
        const signedBytes = await appendSignaturePageToPdfBytes(baseBytes, latest);

        const safeName = fallbackName.replace(/[^\w.-]+/g, "_");
        return new NextResponse(new Uint8Array(signedBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
                "Cache-Control": "no-store",
                "X-Signatures": String(signatures.length),
            },
        });
    } catch (error: unknown) {
        console.error("Signed PDF error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
