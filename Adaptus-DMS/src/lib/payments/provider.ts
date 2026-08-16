/**
 * Payment provider abstraction.
 *
 * The app talks to a `PaymentProvider`; today the only implementation is
 * Stripe (env-gated). When Stripe is not configured, `getPaymentProvider()`
 * returns the `UnconfiguredPaymentProvider`, which fails closed with a clear,
 * honest error — no fake checkout URLs, no fake charges.
 */

import { getPaymentProviderConfig } from "./config";
import { stripeSecretKey } from "./config";
import type { PaymentTarget } from "./types";
import {
    createStripeCheckout,
    StripeNotConfiguredError,
    type CreateCheckoutParams,
} from "./stripe";

export interface CreateCheckoutInput {
    target: PaymentTarget;
    amountCents: number;
    currency: string;
    description: string;
    dealershipId: string | null;
    customerEmail?: string | null;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
}

interface PaymentProvider {    readonly name: "stripe" | "none";
    readonly configured: boolean;
    createCheckout(input: CreateCheckoutInput): Promise<{
        checkoutId: string;
        url: string;
    }>;
}

class UnconfiguredPaymentProvider implements PaymentProvider {
    readonly name = "none" as const;
    readonly configured = false;

    async createCheckout(): Promise<{ checkoutId: string; url: string }> {
        throw new StripeNotConfiguredError();
    }
}

class StripePaymentProvider implements PaymentProvider {
    readonly name = "stripe" as const;
    readonly configured = true;

    async createCheckout(input: CreateCheckoutInput): Promise<{
        checkoutId: string;
        url: string;
    }> {
        const secretKey = stripeSecretKey();
        if (!secretKey) throw new StripeNotConfiguredError();

        const params: CreateCheckoutParams = {
            secretKey,
            amountCents: input.amountCents,
            currency: input.currency,
            description: input.description,
            target: input.target,
            dealershipId: input.dealershipId,
            customerEmail: input.customerEmail,
            successUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
            metadata: input.metadata,
        };

        const { checkoutId, url } = await createStripeCheckout(params);
        if (!url) {
            throw new Error("Stripe did not return a checkout URL");
        }
        return { checkoutId, url };
    }
}

const unconfigured = new UnconfiguredPaymentProvider();

/** Returns the Stripe provider when fully configured, else the fail-closed one. */
export function getPaymentProvider(): PaymentProvider {
    const { configured } = getPaymentProviderConfig();
    return configured ? new StripePaymentProvider() : unconfigured;
}
