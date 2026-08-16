// POST /api/quotations/[id]/send — email quotation via Resend (HTML + PDF attachment)
import { NextRequest, NextResponse } from "next/server";
import {
    assertOwnershipOrDeny,
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import {
    buildQuotationPdfBytes,
    type QuotationPdfPayload,
} from "@/src/lib/quotation-pdf";
import { quotationEmailHtml } from "@/src/lib/quotation-share";
import { isResendConfigured, sendEmail } from "@/src/lib/resend";
import { resolveEmailFrom } from "@/src/lib/email/from";

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        if (!isResendConfigured()) {
            return NextResponse.json(
                {
                    error:
                        "Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM (Settings → Integrations). Status was not changed — use Mark as Sent only when you delivered the quote yourself.",
                    missingConfig: true,
                },
                { status: 503 }
            );
        }

        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            to?: string;
            mark_sent?: boolean;
        };

        const { supabase } = pickSupabaseClient(req, auth.profile);

        const { data: existing, error: existingError } = await supabase
            .from("quotations")
            .select(
                `
                id, dealership_id, salesperson_id, quote_number, status, created_at,
                sale_price, down_payment, trade_in_value, finance_term,
                interest_rate, tax_rate, admin_fee, monthly_payment, notes, valid_until,
                finance_company,
                vehicle:vehicles(id, year, make, model, vin, stock_number),
                customer:customers(id, name, email, phone)
            `
            )
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Quotation not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        if (existing.status === "Converted" || existing.status === "Cancelled") {
            return NextResponse.json(
                { error: `Cannot email a ${existing.status} quotation` },
                { status: 400 }
            );
        }

        const customer = Array.isArray(existing.customer)
            ? existing.customer[0]
            : existing.customer;
        const vehicle = Array.isArray(existing.vehicle)
            ? existing.vehicle[0]
            : existing.vehicle;

        const to =
            (typeof body.to === "string" && body.to.trim()) ||
            (customer?.email as string | undefined)?.trim() ||
            "";

        if (!to || !to.includes("@")) {
            return NextResponse.json(
                {
                    error:
                        'Customer has no email. Pass { to: "email@example.com" } or set customer email.',
                },
                { status: 400 }
            );
        }

        let dealerName: string | null = null;
        let dealerForPdf: QuotationPdfPayload["dealer"] = null;
        let emailFrom: string | undefined;
        if (existing.dealership_id) {
            const { data: dealer } = await supabase
                .from("dealerships")
                .select(
                    "name, business_name, business_address, business_phone, business_email, settings"
                )
                .eq("id", existing.dealership_id)
                .maybeSingle();
            if (dealer) {
                dealerName =
                    (dealer.business_name as string) ||
                    (dealer.name as string) ||
                    null;
                const settings =
                    dealer.settings && typeof dealer.settings === "object"
                        ? (dealer.settings as Record<string, unknown>)
                        : {};
                emailFrom = resolveEmailFrom(settings).from;
                dealerForPdf = {
                    name: (dealer.name as string) || null,
                    business_name: (dealer.business_name as string) || null,
                    business_address: (dealer.business_address as string) || null,
                    business_phone: (dealer.business_phone as string) || null,
                    business_email: (dealer.business_email as string) || null,
                    dealer_license:
                        (typeof settings.dealer_license === "string"
                            ? settings.dealer_license
                            : null) ||
                        (typeof settings.license_number === "string"
                            ? settings.license_number
                            : null),
                    hst_number:
                        typeof settings.hst_number === "string"
                            ? settings.hst_number
                            : null,
                };
            }
        }

        const vehicleLabel = vehicle
            ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
            : null;

        const sharePayload = {
            quoteNumber: existing.quote_number,
            status: existing.status,
            customerName: (customer?.name as string) || null,
            customerEmail: (customer?.email as string) || null,
            vehicleLabel,
            salePrice: Number(existing.sale_price) || 0,
            downPayment: Number(existing.down_payment) || 0,
            tradeInValue: Number(existing.trade_in_value) || 0,
            financeTerm: existing.finance_term,
            interestRate: existing.interest_rate,
            taxRate: existing.tax_rate,
            adminFee: Number(existing.admin_fee) || 0,
            monthlyPayment: existing.monthly_payment,
            notes: existing.notes,
            validUntil: existing.valid_until,
            dealerName,
        };

        const { subject, html, text } = quotationEmailHtml(sharePayload);

        const pdfPayload: QuotationPdfPayload = {
            quoteNumber: existing.quote_number,
            status: existing.status,
            createdAt: existing.created_at,
            validUntil: existing.valid_until,
            notes: existing.notes,
            customerName: (customer?.name as string) || null,
            customerEmail: (customer?.email as string) || null,
            customerPhone: (customer?.phone as string) || null,
            vehicleLabel,
            vin: (vehicle?.vin as string) || null,
            stockNumber: (vehicle?.stock_number as string) || null,
            salePrice: Number(existing.sale_price) || 0,
            downPayment: Number(existing.down_payment) || 0,
            tradeInValue: Number(existing.trade_in_value) || 0,
            taxRate: existing.tax_rate,
            taxAmount: null,
            adminFee: Number(existing.admin_fee) || 0,
            financedAmount: null,
            financeTerm: existing.finance_term,
            interestRate: existing.interest_rate,
            monthlyPayment: existing.monthly_payment,
            financeCompany: existing.finance_company,
            dealer: dealerForPdf,
        };

        const pdfBytes = await buildQuotationPdfBytes(pdfPayload);
        const filename = `Quotation-${existing.quote_number || id}.pdf`;

        const sent = await sendEmail({
            to,
            from: emailFrom,
            subject,
            html,
            text,
            attachments: [
                {
                    filename,
                    content: uint8ToBase64(pdfBytes),
                    contentType: "application/pdf",
                },
            ],
        });

        if (!sent.ok) {
            return NextResponse.json(
                { error: sent.error, missingConfig: sent.missingConfig },
                { status: sent.missingConfig ? 503 : 502 }
            );
        }

        const shouldMarkSent = body.mark_sent !== false;
        let quotation = existing;
        if (shouldMarkSent && existing.status === "Draft") {
            const { data: updated, error: updateError } = await supabase
                .from("quotations")
                .update({ status: "Sent" })
                .eq("id", id)
                .select("*")
                .single();
            if (updateError) throw updateError;
            quotation = updated;
        }

        return NextResponse.json({
            success: true,
            resend_id: sent.id,
            to,
            attached: filename,
            quotation,
        });
    } catch (error: unknown) {
        console.error("Error sending quotation:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}
