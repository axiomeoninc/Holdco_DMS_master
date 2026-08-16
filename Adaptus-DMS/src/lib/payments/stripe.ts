/**
 * Stripe adapter — lazy-loaded so the app runs before `stripe` is installed.
 *
 * The `stripe` npm package is an optional dependency installed by the
 * integration worker. All access goes through `loadStripeClient()`, which
 * dynamically imports the SDK only when called (i.e. only when the dealer has
 * actually configured Stripe).
 */

import type { StripeClient, StripeCheckoutSession, StripeEvent } from "stripe";
import type { PaymentTarget } from "./types";

export interface StripeCheckoutResult {
    checkoutId: string;
    url: string | null;
}

export interface CreateCheckoutParams {
    secretKey: string;
    amountCents: number;
    currency: string;
    description: string;
    target: PaymentTarget;
    dealershipId: string | null;
    customerEmail?: string | null;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
}

export class StripeNotConfiguredError extends Error {
    constructor() {
        super(
            "Payments are not configured — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET."
        );
        this.name = "StripeNotConfiguredError";
    }
}

/** Dynamic import of the optional `stripe` dependency (see types/stripe.d.ts). */
export async function loadStripeClient(secretKey: string): Promise<StripeClient> {
    const mod = await import("stripe");
    const StripeCtor = (mod.default ?? mod) as new (
        key: string,
        config?: Record<string, unknown>
    ) => StripeClient;
    return new StripeCtor(secretKey, { apiVersion: "2024-06-20" });
}

/**
 * Create a Stripe Checkout Session (payment mode). Returns the checkout id +
 * hosted checkout URL. The URL is never stored in logs; only the id is kept in
 * payment_records.provider_checkout_id.
 */
export async function createStripeCheckout(
    params: CreateCheckoutParams
): Promise<StripeCheckoutResult> {
    if (!params.secretKey) throw new StripeNotConfiguredError();
    const stripe = await loadStripeClient(params.secretKey);

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
            {
                price_data: {
                    currency: params.currency.toLowerCase(),
                    product_data: {
                        name: params.description,
                    },
                    unit_amount: params.amountCents,
                },
                quantity: 1,
            },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        client_reference_id: params.target.reference_id,
        customer_email: params.customerEmail || undefined,
        metadata: {
            reference_type: params.target.reference_type,
            reference_id: params.target.reference_id,
            dealership_id: params.dealershipId || "",
            ...(params.metadata || {}),
        },
    } as never);

    const sessionTyped = session as StripeCheckoutSession;
    return {
        checkoutId: sessionTyped.id,
        url: sessionTyped.url,
    };
}

/**
 * Verify and parse a Stripe webhook event. Returns null on invalid signature.
 */
export async function constructStripeEvent(
    secretKey: string,
    webhookSecret: string,
    payload: string | Buffer,
    signature: string | string[] | undefined
): Promise<StripeEvent | null> {
    if (!secretKey || !webhookSecret) throw new StripeNotConfiguredError();
    const stripe = await loadStripeClient(secretKey);
    try {
        return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
        console.error("[payments] Stripe webhook signature verification failed:", err);
        return null;
    }
}
