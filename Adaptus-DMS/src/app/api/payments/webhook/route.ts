// app/api/payments/webhook/route.ts
// POST — Stripe webhook endpoint. Verifies the Stripe signature, reconciles the
// pending payment_record, applies the payment to its target (invoice / deal
// deposit / bill of sale), and writes the ledger + audit trail.
//
// Uses the service-role client (server-to-server, RLS bypass) — never a
// dealer token. Authentication is the Stripe signature itself.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    constructStripeEvent,
    stripeSecretKey,
    stripeWebhookSecret,
    applySuccessfulPayment,
    updatePaymentRecordStatus,
} from "@/src/lib/payments";
import { emitDealershipEvent } from "@/src/lib/api/webhooks";
import { logAudit } from "@/src/lib/audit";
import type { PaymentReferenceType } from "@/src/lib/payments";

export async function POST(req: NextRequest) {
    const secretKey = stripeSecretKey();
    const webhookSecret = stripeWebhookSecret();

    if (!secretKey || !webhookSecret) {
        // Honest fail-closed: no webhook processing without config.
        return NextResponse.json(
            { error: "Webhook not configured" },
            { status: 503 }
        );
    }

    const payload = await req.text();
    const signature = req.headers.get("stripe-signature") || undefined;

    const event = await constructStripeEvent(
        secretKey,
        webhookSecret,
        payload,
        signature
    );
    if (!event) {
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = (event.data?.object || {}) as {
                    id?: string;
                    payment_intent?: string | null;
                    amount_total?: number | null;
                    currency?: string | null;
                    metadata?: Record<string, string> | null;
                };
                const metadata = session.metadata || {};
                const referenceType = (metadata.reference_type || "invoice") as PaymentReferenceType;
                const referenceId = metadata.reference_id;
                const dealershipId = metadata.dealership_id || null;
                const checkoutId = session.id;
                const amountCents = Number(session.amount_total) || 0;
                const amount = amountCents / 100;

                if (!referenceId) {
                    return NextResponse.json(
                        { error: "Missing reference_id in session metadata" },
                        { status: 400 }
                    );
                }

                // Reconcile the pre-recorded pending row by checkout id.
                const { data: existing } = await supabaseAdmin
                    .from("payment_records")
                    .select("id")
                    .eq("provider_checkout_id", checkoutId)
                    .maybeSingle();

                let recordId = (existing as { id?: string } | null)?.id ?? null;
                if (recordId) {
                    await updatePaymentRecordStatus(supabaseAdmin, recordId, "succeeded", {
                        provider_payment_id: session.payment_intent || null,
                    });
                } else if (metadata.payment_record_id) {
                    recordId = metadata.payment_record_id;
                    await updatePaymentRecordStatus(supabaseAdmin, recordId, "succeeded", {
                        provider_payment_id: session.payment_intent || null,
                    });
                }

                const { error, warning } = await applySuccessfulPayment(supabaseAdmin, {
                    dealership_id: dealershipId,
                    reference_type: referenceType,
                    reference_id: referenceId,
                    amount,
                    description: `Online payment (Stripe checkout ${checkoutId})`,
                    provider: "stripe",
                });
                if (error) {
                    console.error("[payments] applySuccessfulPayment failed:", error);
                    return NextResponse.json(
                        { error: `Payment applied but reconciliation failed: ${error}` },
                        { status: 500 }
                    );
                }

                await logAudit(supabaseAdmin, {
                    action: "payment.succeeded",
                    entity_type: "payment",
                    entity_id: referenceId,
                    dealership_id: dealershipId,
                    metadata: {
                        provider: "stripe",
                        checkout_id: checkoutId,
                        amount,
                        currency: session.currency || "CAD",
                        payment_record_id: recordId || undefined,
                        warning: warning || undefined,
                    },
                });

                // Emit to configured dealership webhooks (fire-and-forget dispatch).
                if (dealershipId) {
                    await emitDealershipEvent({
                        dealershipId,
                        event: "payment.received",
                        payload: {
                            reference_type: referenceType,
                            reference_id: referenceId,
                            amount,
                            currency: session.currency || "CAD",
                            provider: "stripe",
                            checkout_id: checkoutId,
                            payment_record_id: recordId || undefined,
                        },
                    });
                }

                return NextResponse.json({ received: true });
            }

            case "checkout.session.expired": {
                const session = (event.data?.object || {}) as {
                    id?: string;
                    metadata?: Record<string, string> | null;
                };
                const { data: pending } = await supabaseAdmin
                    .from("payment_records")
                    .select("id")
                    .eq("provider_checkout_id", session.id)
                    .maybeSingle();
                const recordId = (pending as { id?: string } | null)?.id;
                if (recordId) {
                    await updatePaymentRecordStatus(supabaseAdmin, recordId, "cancelled");
                }
                return NextResponse.json({ received: true });
            }

            default:
                // Acknowledge other events; no reconciliation needed.
                return NextResponse.json({ received: true });
        }
    } catch (error: unknown) {
        console.error("[payments] webhook handler error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Webhook processing failed" },
            { status: 500 }
        );
    }
}
