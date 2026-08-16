// POST /api/invoices/[id]/send — email invoice via Resend (HTML + PDF attachment)
import { NextRequest, NextResponse } from "next/server";
import {
    assertOwnershipOrDeny,
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import {
    buildInvoicePdfBytes,
    invoiceEmailHtml,
    parseInvoiceLineItems,
    type InvoicePdfPayload,
} from "@/src/lib/invoice-pdf";
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
                        "Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM (Settings → Integrations).",
                    missingConfig: true,
                },
                { status: 503 }
            );
        }

        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            to?: string;
        };

        const { supabase } = pickSupabaseClient(req, auth.profile);

        const { data: existing, error: existingError } = await supabase
            .from("invoices")
            .select(
                `
                id, dealership_id, invoice_number, invoice_date, due_date, status,
                package_name, notes, payment_amount, tax_rate, tax_amount, total,
                amount_paid, line_items,
                customer:customers(id, name, email, phone, address, city, province)
            `
            )
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Invoice not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const customer = Array.isArray(existing.customer)
            ? existing.customer[0]
            : existing.customer;
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
        let dealerAddress: string | null = null;
        let dealerPhone: string | null = null;
        let dealerEmail: string | null = null;
        let dealerHst: string | null = null;
        let dealerLicence: string | null = null;
        let dealerLogoUrl: string | null = null;
        let emailFrom: string | undefined;

        if (existing.dealership_id) {
            const { data: dealer } = await supabase
                .from("dealerships")
                .select(
                    "name, business_name, business_address, business_phone, business_email, logo_url, settings"
                )
                .eq("id", existing.dealership_id)
                .maybeSingle();
            if (dealer) {
                dealerName =
                    (dealer.business_name as string) ||
                    (dealer.name as string) ||
                    null;
                dealerAddress = (dealer.business_address as string) || null;
                dealerPhone = (dealer.business_phone as string) || null;
                dealerEmail = (dealer.business_email as string) || null;
                dealerLogoUrl = (dealer.logo_url as string) || null;
                const settings =
                    dealer.settings && typeof dealer.settings === "object"
                        ? (dealer.settings as Record<string, unknown>)
                        : {};
                dealerLicence =
                    (typeof settings.dealer_license === "string"
                        ? settings.dealer_license
                        : null) ||
                    (typeof settings.license_number === "string"
                        ? settings.license_number
                        : null);
                dealerHst =
                    typeof settings.hst_number === "string"
                        ? settings.hst_number
                        : null;
                emailFrom = resolveEmailFrom(settings).from;
            }
        }

        let ledgerQuery = supabase
            .from("financial_transactions")
            .select("amount, description, category, transaction_date")
            .eq("reference_type", "invoice")
            .eq("reference_id", id)
            .eq("transaction_type", "Payment")
            .order("transaction_date", { ascending: true });
        if (!auth.profile.is_platform_admin && auth.profile.dealership_id) {
            ledgerQuery = ledgerQuery.eq(
                "dealership_id",
                auth.profile.dealership_id
            );
        }
        const { data: paymentRows } = await ledgerQuery;

        const addrParts = [
            customer?.address,
            customer?.city,
            customer?.province,
        ].filter(Boolean);

        const payload: InvoicePdfPayload = {
            invoiceNumber: existing.invoice_number,
            invoiceDate: existing.invoice_date,
            dueDate: existing.due_date,
            status: existing.status,
            packageName: existing.package_name,
            notes: existing.notes,
            paymentInstructions: existing.notes,
            subtotal: Number(existing.payment_amount) || 0,
            taxRate: Number(existing.tax_rate) || 0,
            taxAmount: Number(existing.tax_amount) || 0,
            total: Number(existing.total) || 0,
            amountPaid: Number(existing.amount_paid) || 0,
            customerName: customer?.name || null,
            customerEmail: customer?.email || null,
            customerPhone: customer?.phone || null,
            customerAddress: addrParts.join(", ") || null,
            dealerName,
            dealerAddress,
            dealerPhone,
            dealerEmail,
            dealerHst,
            dealerLicence,
            dealerLogoUrl,
            lineItems: parseInvoiceLineItems(existing.line_items),
            payments: (paymentRows || []).map(
                (p: {
                    transaction_date: string;
                    amount: number;
                    category?: string | null;
                    description?: string | null;
                }) => ({
                    date: p.transaction_date,
                    amount: Number(p.amount) || 0,
                    method: p.category || undefined,
                    note: p.description || undefined,
                })
            ),
        };

        const { subject, html, text } = invoiceEmailHtml(payload);
        const pdfBytes = await buildInvoicePdfBytes(payload);
        const filename = `Invoice-${existing.invoice_number || id}.pdf`;

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

        return NextResponse.json({
            success: true,
            resend_id: sent.id,
            to,
            attached: filename,
        });
    } catch (error: unknown) {
        console.error("Error sending invoice:", error);
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
