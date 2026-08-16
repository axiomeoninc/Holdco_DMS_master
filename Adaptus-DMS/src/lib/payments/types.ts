/**
 * Payment record types — provider-agnostic ledger of payment intents/results.
 */

export type PaymentProvider = "stripe" | "manual";

export type PaymentRecordStatus =
    | "pending"
    | "requires_action"
    | "succeeded"
    | "failed"
    | "refunded"
    | "cancelled";

export type PaymentReferenceType = "invoice" | "deal" | "deposit" | "bill_of_sale";

export const PAYMENT_REFERENCE_TYPES: PaymentReferenceType[] = [
    "invoice",
    "deal",
    "deposit",
    "bill_of_sale",
];

export interface PaymentTarget {
    reference_type: PaymentReferenceType;
    reference_id: string;
}

export interface PaymentRecord {
    id: string;
    dealership_id: string | null;
    provider: string;
    provider_checkout_id: string | null;
    provider_payment_id: string | null;
    amount: number;
    currency: string;
    status: PaymentRecordStatus;
    reference_type: PaymentReferenceType;
    reference_id: string;
    description: string | null;
    failure_reason: string | null;
    created_by: string | null;
    created_at: string;
}

/** Provider config surfaced to the UI (honest "not configured" state). */
export interface PaymentProviderConfig {
    configured: boolean;
    provider: PaymentProvider | null;
    /** Stripe publishable key to render the client-side checkout (never the secret). */
    publishableKey: string | null;
    currency: string;
}
