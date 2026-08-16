/**
 * Minimal ambient typing for the optional `stripe` dependency.
 *
 * `stripe` is listed in package.json dependencies but installed by the
 * integration worker (parallel agents must not touch node_modules). This
 * declaration lets TypeScript resolve `import("stripe")` BEFORE the package is
 * installed. Once the real package is installed, its own (much richer) types
 * take precedence over this ambient declaration, so nothing here constrains
 * the real SDK.
 */
declare module "stripe" {
    export interface StripeCheckoutSessionCreateParams {
        mode?: "payment" | "subscription" | "setup";
        line_items?: Array<Record<string, unknown>>;
        success_url?: string;
        cancel_url?: string;
        client_reference_id?: string;
        customer_email?: string;
        metadata?: Record<string, string>;
        payment_intent_data?: Record<string, unknown>;
        expires_at?: number;
    }

    export interface StripeCheckoutSession {
        id: string;
        url: string | null;
        payment_status?: string;
        amount_total?: number | null;
        currency?: string | null;
        client_reference_id?: string | null;
        metadata?: Record<string, string> | null;
    }

    export interface StripeEvent {
        id?: string;
        type?: string;
        data?: { object?: Record<string, unknown> | null };
    }

    export interface StripeWebhookEndpoint {
        constructEvent(
            payload: string | Buffer,
            signature: string | string[] | undefined,
            secret: string
        ): StripeEvent;
    }

    export interface StripeClient {
        checkout: {
            sessions: {
                create(
                    params: StripeCheckoutSessionCreateParams
                ): Promise<StripeCheckoutSession>;
            };
        };
        webhooks: StripeWebhookEndpoint;
    }

    export default class Stripe implements StripeClient {
        constructor(secretKey: string, config?: Record<string, unknown>);
        checkout: StripeClient["checkout"];
        webhooks: StripeClient["webhooks"];
    }
}
