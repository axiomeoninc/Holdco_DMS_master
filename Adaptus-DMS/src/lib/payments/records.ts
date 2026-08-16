/**
 * Payment record + application helpers.
 *
 * Used by the webhook and checkout flows to write payment_records rows and to
 * apply a successful payment to its target (invoice / deal deposit / BOS) with
 * a matching financial_transactions ledger line.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    PaymentRecordStatus,
    PaymentReferenceType,
} from "./types";

type AnyClient = SupabaseClient;

export interface UpsertPaymentRecordInput {
    dealership_id: string | null;
    provider: string;
    status: PaymentRecordStatus;
    amount: number;
    currency: string;
    reference_type: PaymentReferenceType;
    reference_id: string;
    description?: string | null;
    provider_checkout_id?: string | null;
    provider_payment_id?: string | null;
    failure_reason?: string | null;
    metadata?: Record<string, unknown>;
    created_by?: string | null;
}

export async function insertPaymentRecord(
    supabase: AnyClient,
    input: UpsertPaymentRecordInput
): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await supabase
        .from("payment_records")
        .insert({
            dealership_id: input.dealership_id,
            provider: input.provider,
            status: input.status,
            amount: input.amount,
            currency: input.currency,
            reference_type: input.reference_type,
            reference_id: input.reference_id,
            description: input.description ?? null,
            provider_checkout_id: input.provider_checkout_id ?? null,
            provider_payment_id: input.provider_payment_id ?? null,
            failure_reason: input.failure_reason ?? null,
            metadata: input.metadata ?? {},
            created_by: input.created_by ?? null,
        })
        .select("id")
        .single();
    if (error) {
        console.error("[payments] insertPaymentRecord failed:", error.message);
        return { id: null, error: error.message };
    }
    return { id: (data as { id?: string } | null)?.id ?? null, error: null };
}

export async function updatePaymentRecordStatus(
    supabase: AnyClient,
    recordId: string,
    status: PaymentRecordStatus,
    extra: { provider_payment_id?: string | null; failure_reason?: string | null } = {}
): Promise<{ error: string | null }> {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (extra.provider_payment_id) patch.provider_payment_id = extra.provider_payment_id;
    if (extra.failure_reason !== undefined) patch.failure_reason = extra.failure_reason;
    const { error } = await supabase.from("payment_records").update(patch).eq("id", recordId);
    if (error) console.error("[payments] updatePaymentRecordStatus failed:", error.message);
    return { error: error?.message ?? null };
}

/** Balance due on an invoice, given its totals. */
export function invoiceBalanceDue(total: number, amountPaid: number): number {
    return Math.max(0, (Number(total) || 0) - (Number(amountPaid) || 0));
}

/**
 * Apply a successful provider payment to its target:
 *  - invoice:      amount_paid += amount; status → Paid when covered
 *  - deal/deposit: deposit_paid += amount; payment_status → "Deposit Paid"/"Paid"
 *  - bill_of_sale: payment_status → "Paid"
 * Also writes a financial_transactions 'Payment' line.
 */
export async function applySuccessfulPayment(
    supabase: AnyClient,
    input: {
        dealership_id: string | null;
        reference_type: PaymentReferenceType;
        reference_id: string;
        amount: number;
        description: string;
        provider: string;
        recorded_by?: string | null;
        payment_date?: string | null;
    }
): Promise<{ error: string | null; warning?: string }> {
    const amount = Number(input.amount) || 0;
    const paymentDate = input.payment_date || (new Date().toISOString().split("T")[0] ?? "");

    if (input.reference_type === "invoice") {
        const { data: invoice, error: fetchErr } = await supabase
            .from("invoices")
            .select("id, dealership_id, total, amount_paid, status")
            .eq("id", input.reference_id)
            .single();
        if (fetchErr || !invoice) {
            return { error: fetchErr?.message || "Invoice not found" };
        }
        const prevPaid = Number(invoice.amount_paid) || 0;
        const total = Number(invoice.total) || 0;
        const nextPaid = prevPaid + amount;
        const nextStatus =
            nextPaid >= total - 0.009
                ? "Paid"
                : invoice.status === "Overdue"
                  ? "Overdue"
                  : "Pending";

        const { error: updErr } = await supabase
            .from("invoices")
            .update({ amount_paid: nextPaid, status: nextStatus })
            .eq("id", input.reference_id);
        if (updErr) return { error: updErr.message };

        const { error: ledgerErr } = await supabase
            .from("financial_transactions")
            .insert({
                transaction_type: "Payment",
                category: input.provider,
                amount,
                description: input.description,
                reference_id: input.reference_id,
                reference_type: "invoice",
                transaction_date: paymentDate,
                recorded_by: input.recorded_by ?? null,
                dealership_id: input.dealership_id,
            });
        if (ledgerErr) return { error: ledgerErr.message };
        return { error: null, warning: nextPaid > total + 0.01 ? "Overpayment recorded." : undefined };
    }

    if (input.reference_type === "deal" || input.reference_type === "deposit") {
        const { data: deal, error: fetchErr } = await supabase
            .from("sales_deals")
            .select("id, dealership_id, deposit_amount, deposit_paid, payment_status")
            .eq("id", input.reference_id)
            .single();
        if (fetchErr || !deal) {
            return { error: fetchErr?.message || "Deal not found" };
        }
        const depositTarget = Number(deal.deposit_amount) || 0;
        const depositPaid = Number(deal.deposit_paid) || 0;
        const nextDeposit = depositPaid + amount;
        const nextStatus =
            depositTarget > 0 && nextDeposit >= depositTarget - 0.009
                ? "Deposit Paid"
                : nextDeposit > 0
                  ? "Partially Paid"
                  : deal.payment_status || "Unpaid";

        const { error: updErr } = await supabase
            .from("sales_deals")
            .update({ deposit_paid: nextDeposit, payment_status: nextStatus })
            .eq("id", input.reference_id);
        if (updErr) return { error: updErr.message };

        const { error: ledgerErr } = await supabase
            .from("financial_transactions")
            .insert({
                transaction_type: "Payment",
                category: input.provider,
                amount,
                description: input.description,
                reference_id: input.reference_id,
                reference_type: "deal",
                transaction_date: paymentDate,
                recorded_by: input.recorded_by ?? null,
                dealership_id: input.dealership_id,
            });
        if (ledgerErr) return { error: ledgerErr.message };
        return { error: null };
    }

    if (input.reference_type === "bill_of_sale") {
        const { error: updErr } = await supabase
            .from("bill_of_sale")
            .update({ payment_status: "Paid" })
            .eq("id", input.reference_id);
        if (updErr) return { error: updErr.message };
        const { error: ledgerErr } = await supabase
            .from("financial_transactions")
            .insert({
                transaction_type: "Payment",
                category: input.provider,
                amount,
                description: input.description,
                reference_id: input.reference_id,
                reference_type: "bill_of_sale",
                transaction_date: paymentDate,
                recorded_by: input.recorded_by ?? null,
                dealership_id: input.dealership_id,
            });
        if (ledgerErr) return { error: ledgerErr.message };
        return { error: null };
    }

    return { error: `Unsupported reference_type: ${input.reference_type}` };
}
