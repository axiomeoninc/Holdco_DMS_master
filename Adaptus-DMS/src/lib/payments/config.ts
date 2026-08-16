/**
 * Payment provider configuration — env-gated, honest "not configured" state.
 *
 * Nothing is charged and no checkout session can be created until BOTH the
 * secret key and webhook secret are present. The UI receives `configured:
 * false` and shows the amber "Payments not configured" banner.
 */

import type { PaymentProviderConfig } from "./types";

export const PAYMENT_CURRENCY = "CAD";

export function stripeSecretKey(): string | null {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    return key ? key : null;
}

export function stripePublishableKey(): string | null {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    return key ? key : null;
}

export function stripeWebhookSecret(): string | null {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    return secret ? secret : null;
}

/**
 * True only when the full Stripe flow can actually charge a card
 * (secret + webhook secret). A publishable key alone is NOT enough.
 */
export function isStripeConfigured(): boolean {
    return Boolean(stripeSecretKey() && stripeWebhookSecret());
}

export function getPaymentProviderConfig(): PaymentProviderConfig {
    const configured = isStripeConfigured();
    return {
        configured,
        provider: configured ? "stripe" : null,
        publishableKey: stripePublishableKey(),
        currency: PAYMENT_CURRENCY,
    };
}
