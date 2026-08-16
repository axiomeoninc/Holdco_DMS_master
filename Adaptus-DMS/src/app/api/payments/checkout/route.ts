// app/api/payments/checkout/route.ts
// POST — create a hosted Stripe Checkout Session for an invoice balance, a
// deal deposit, or a bill-of-sale balance. Honest fail-closed when Stripe is
// not configured: no checkout URL is ever fabricated.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import {
    getPaymentProvider,
    getPaymentProviderConfig,
    insertPaymentRecord,
    invoiceBalanceDue,
    PAYMENT_REFERENCE_TYPES,
} from "@/src/lib/payments";
import type {
    PaymentReferenceType,
} from "@/src/lib/payments";

type Supabase = typeof supabaseAdmin;

const NOT_CONFIGURED_MESSAGE =
    "Payments are not configured — online checkout is not live yet. No charge was made.";

async function resolveTarget(
    supabase: Supabase,
    referenceType: PaymentReferenceType,
    referenceId: string
): Promise<{
    amountDue: number;
    description: string;
    dealership_id: string | null;
    customer_email: string | null;
    error: NextResponse | null;
}> {
    if (referenceType === "invoice") {
        const { data, error } = await supabase
            .from("invoices")
            .select("id, dealership_id, total, amount_paid, status, invoice_number, customer:customers(email)")
            .eq("id", referenceId)
            .single();
        if (error) {
            return {
                amountDue: 0,
                description: "",
                dealership_id: null,
                customer_email: null,
                error: NextResponse.json(
                    { error: error.code === "PGRST116" ? "Invoice not found" : error.message },
                    { status: error.code === "PGRST116" ? 404 : 500 }
                ),
            };
        }
        if (data.status === "Cancelled") {
            return {
                amountDue: 0,
                description: "",
                dealership_id: null,
                customer_email: null,
                error: NextResponse.json(
                    { error: "Cannot take payment on a cancelled invoice" },
                    { status: 400 }
                ),
            };
        }
        const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
        return {
            amountDue: invoiceBalanceDue(Number(data.total) || 0, Number(data.amount_paid) || 0),
            description: `Payment on invoice ${data.invoice_number || referenceId.slice(0, 8)}`,
            dealership_id: data.dealership_id || null,
            customer_email: customer?.email || null,
            error: null,
        };
    }

    if (referenceType === "deal" || referenceType === "deposit") {
        const { data, error } = await supabase
            .from("sales_deals")
            .select("id, dealership_id, deposit_amount, deposit_paid, deal_status")
            .eq("id", referenceId)
            .single();
        if (error) {
            return {
                amountDue: 0,
                description: "",
                dealership_id: null,
                customer_email: null,
                error: NextResponse.json(
                    { error: error.code === "PGRST116" ? "Deal not found" : error.message },
                    { status: error.code === "PGRST116" ? 404 : 500 }
                ),
            };
        }
        if (["Cancelled", "Lost"].includes(data.deal_status || "")) {
            return {
                amountDue: 0,
                description: "",
                dealership_id: null,
                customer_email: null,
                error: NextResponse.json(
                    { error: "Cannot take a deposit on a cancelled or lost deal" },
                    { status: 400 }
                ),
            };
        }
        const depositAmount = Number(data.deposit_amount) || 0;
        const depositPaid = Number(data.deposit_paid) || 0;
        return {
            amountDue: Math.max(0, depositAmount - depositPaid),
            description: `Deposit on deal ${referenceId.slice(0, 8)}`,
            dealership_id: data.dealership_id || null,
            customer_email: null,
            error: null,
        };
    }

    if (referenceType === "bill_of_sale") {
        const { data, error } = await supabase
            .from("bill_of_sale")
            .select("id, dealership_id, total_balance_due, buyer_name, buyer_email")
            .eq("id", referenceId)
            .single();
        if (error) {
            return {
                amountDue: 0,
                description: "",
                dealership_id: null,
                customer_email: null,
                error: NextResponse.json(
                    { error: error.code === "PGRST116" ? "Bill of sale not found" : error.message },
                    { status: error.code === "PGRST116" ? 404 : 500 }
                ),
            };
        }
        return {
            amountDue: Math.max(0, Number(data.total_balance_due) || 0),
            description: `Bill of sale balance (${data.buyer_name || "customer"})`,
            dealership_id: data.dealership_id || null,
            customer_email: data.buyer_email || null,
            error: null,
        };
    }

    return {
        amountDue: 0,
        description: "",
        dealership_id: null,
        customer_email: null,
        error: NextResponse.json({ error: "Unsupported reference_type" }, { status: 400 }),
    };
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const body = (await req.json()) as Record<string, unknown>;
        const referenceType = String(body.reference_type ?? "").trim() as PaymentReferenceType;
        const referenceId = String(body.reference_id ?? "").trim();
        const successPath =
            typeof body.success_path === "string" && body.success_path.startsWith("/")
                ? body.success_path
                : "/";
        const cancelPath =
            typeof body.cancel_path === "string" && body.cancel_path.startsWith("/")
                ? body.cancel_path
                : "/";

        if (!PAYMENT_REFERENCE_TYPES.includes(referenceType)) {
            return NextResponse.json(
                { error: `reference_type must be one of: ${PAYMENT_REFERENCE_TYPES.join(", ")}` },
                { status: 400 }
            );
        }
        if (!referenceId) {
            return NextResponse.json({ error: "reference_id is required" }, { status: 400 });
        }

        const supabase = supabaseAdmin;
        const target = await resolveTarget(supabase, referenceType, referenceId);
        if (target.error) return target.error;

        // Amount override is only honored for deposits; otherwise balance due.
        let amountDue = target.amountDue;
        if (referenceType === "deal" || referenceType === "deposit") {
            const requested = Number(body.amount);
            if (Number.isFinite(requested) && requested > 0) {
                amountDue = Math.min(amountDue > 0 ? amountDue : Number.POSITIVE_INFINITY, requested);
            }
        }

        if (amountDue <= 0) {
            return NextResponse.json(
                { error: "Nothing to pay — the balance is already covered" },
                { status: 400 }
            );
        }

        // Honest config gate — never fabricate a checkout URL.
        const config = getPaymentProviderConfig();
        if (!config.configured) {
            return NextResponse.json(
                {
                    error: NOT_CONFIGURED_MESSAGE,
                    code: "PAYMENTS_NOT_CONFIGURED",
                    configured: false,
                },
                { status: 409 }
            );
        }

        const provider = getPaymentProvider();
        const origin = req.nextUrl.origin;
        const amountCents = Math.round(amountDue * 100);

        // Pre-record the pending intent so the webhook can reconcile by checkout id.
        const { id: recordId, error: recordErr } = await insertPaymentRecord(supabase, {
            dealership_id: target.dealership_id || auth.profile.dealership_id || null,
            provider: "stripe",
            status: "pending",
            amount: amountDue,
            currency: config.currency,
            reference_type: referenceType,
            reference_id: referenceId,
            description: target.description,
            provider_checkout_id: null,
            created_by: auth.profile.id,
        });
        if (recordErr) throw new Error(recordErr);

        const { checkoutId, url } = await provider.createCheckout({
            target: { reference_type: referenceType, reference_id: referenceId },
            amountCents,
            currency: config.currency,
            description: target.description,
            dealershipId: target.dealership_id || auth.profile.dealership_id,
            customerEmail: target.customer_email,
            successUrl: `${origin}${successPath}`,
            cancelUrl: `${origin}${cancelPath}`,
            metadata: { payment_record_id: recordId || "" },
        });

        // Link the checkout id back to the pending record.
        if (recordId) {
            await supabase
                .from("payment_records")
                .update({ provider_checkout_id: checkoutId })
                .eq("id", recordId);
        }

        return NextResponse.json({
            data: { url, checkout_id: checkoutId, reference_type: referenceType, reference_id: referenceId },
            configured: true,
        });
    } catch (error: unknown) {
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
