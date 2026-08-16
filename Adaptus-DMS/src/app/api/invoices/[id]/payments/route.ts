// app/api/invoices/[id]/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    assertOwnershipOrDeny,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { canEdit } from "@/src/lib/permission-middleware";

/**
 * GET — AR ledger rows for an invoice.
 * POST — record payment → financial_transactions + amount_paid / status.
 * Response shapes match InvoiceDetailsModal.
 */

export async function GET(
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

        const supabase = supabaseAdmin;

        const { id } = await params;

        const { data: existing, error: existingError } = await supabase
            .from("invoices")
            .select("id, dealership_id, total, amount_paid, status")
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

        let ledgerQuery = supabase
            .from("financial_transactions")
            .select(
                "id, amount, description, category, transaction_date, recorded_by, created_at"
            )
            .eq("reference_type", "invoice")
            .eq("reference_id", id)
            .eq("transaction_type", "Payment")
            .order("transaction_date", { ascending: false });

        if (!auth.profile.is_platform_admin && auth.profile.dealership_id) {
            ledgerQuery = ledgerQuery.eq(
                "dealership_id",
                auth.profile.dealership_id
            );
        }

        const { data: payments, error: payError } = await ledgerQuery;
        if (payError) throw payError;

        const amountPaid = Number(existing.amount_paid) || 0;
        const total = Number(existing.total) || 0;

        return NextResponse.json({
            data: payments || [],
            totals: {
                amountPaid,
                balanceDue: Math.max(0, total - amountPaid),
            },
        });
    } catch (error: unknown) {
        console.error("Error fetching invoice payments:", error);
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

        if (
            !canEdit(
                auth.profile.role,
                auth.profile.user_permissions || [],
                "invoices",
                auth.profile.is_platform_admin
            )
        ) {
            return NextResponse.json(
                { error: "Forbidden - You cannot record invoice payments" },
                { status: 403 }
            );
        }

        const supabase = supabaseAdmin;

        const { id } = await params;
        const body = await req.json();
        const amount = parseFloat(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { error: "amount must be a positive number" },
                { status: 400 }
            );
        }

        const method =
            typeof body.method === "string" && body.method.trim()
                ? body.method.trim()
                : "Other";
        const note =
            typeof body.note === "string" && body.note.trim()
                ? body.note.trim()
                : null;
        const paymentDate =
            typeof body.payment_date === "string" && body.payment_date
                ? body.payment_date
                : new Date().toISOString().split("T")[0];

        const { data: existing, error: existingError } = await supabase
            .from("invoices")
            .select(
                "id, dealership_id, total, amount_paid, status, invoice_number"
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

        if (existing.status === "Cancelled") {
            return NextResponse.json(
                { error: "Cannot record payment on a cancelled invoice" },
                { status: 400 }
            );
        }

        const dealershipId =
            existing.dealership_id || auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context for payment" },
                { status: 403 }
            );
        }

        const prevPaid = Number(existing.amount_paid) || 0;
        const total = Number(existing.total) || 0;
        const nextPaid = prevPaid + amount;
        let warning: string | undefined;
        if (nextPaid > total + 0.01) {
            warning = "Payment exceeds invoice total — recorded as overpayment.";
        }
        const nextStatus =
            nextPaid >= total - 0.009
                ? "Paid"
                : existing.status === "Overdue"
                  ? "Overdue"
                  : "Pending";

        const descriptionParts = [
            `Payment on invoice ${existing.invoice_number}`,
            method !== "Other" ? `via ${method}` : null,
            note,
        ].filter(Boolean);

        // Provider-agnostic record: when a provider (e.g. stripe) charge backs
        // this manual recording, mirror it into payment_records for the ledger.
        const ALLOWED_PROVIDERS = ["stripe", "manual", "cash", "cheque", "etransfer"];
        const provider =
            typeof body.provider === "string" &&
            ALLOWED_PROVIDERS.includes(body.provider.trim())
                ? body.provider.trim()
                : null;
        const providerPaymentId =
            typeof body.provider_payment_id === "string"
                ? body.provider_payment_id.trim()
                : null;
        const providerCheckoutId =
            typeof body.provider_checkout_id === "string"
                ? body.provider_checkout_id.trim()
                : null;

        const { data: txn, error: txnError } = await supabase
            .from("financial_transactions")
            .insert({
                transaction_type: "Payment",
                category: method,
                amount,
                description: descriptionParts.join(" — "),
                reference_id: id,
                reference_type: "invoice",
                transaction_date: paymentDate,
                recorded_by: auth.profile.id,
                dealership_id: dealershipId,
            })
            .select()
            .single();

        if (txnError) throw txnError;

        if (provider && (providerPaymentId || providerCheckoutId)) {
            const { error: providerRecordErr } = await supabase
                .from("payment_records")
                .insert({
                    dealership_id: dealershipId,
                    provider,
                    provider_checkout_id: providerCheckoutId,
                    provider_payment_id: providerPaymentId,
                    amount,
                    currency: "CAD",
                    status: "succeeded",
                    reference_type: "invoice",
                    reference_id: id,
                    description: descriptionParts.join(" — "),
                    created_by: auth.profile.id,
                });
            if (providerRecordErr) {
                console.warn(
                    "[payments] failed to mirror provider payment record:",
                    providerRecordErr.message
                );
            }
        }

        const { data: updated, error: updError } = await supabase
            .from("invoices")
            .update({
                amount_paid: nextPaid,
                status: nextStatus,
            })
            .eq("id", id)
            .select(
                `*, customer:customers(id, name, email, phone)`
            )
            .single();

        if (updError) {
            // Compensating delete — do not leave ledger rows without amount_paid update.
            if (txn?.id) {
                await supabase
                    .from("financial_transactions")
                    .delete()
                    .eq("id", txn.id);
            }
            throw updError;
        }

        return NextResponse.json(
            {
                invoice: updated,
                payment: txn,
                totals: {
                    amountPaid: nextPaid,
                    balanceDue: Math.max(0, total - nextPaid),
                },
                warning,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Error recording invoice payment:", error);
        const message =
            error instanceof Error
                ? error.message
                : typeof error === "object" &&
                    error !== null &&
                    "message" in error &&
                    typeof (error as { message: unknown }).message === "string"
                  ? (error as { message: string }).message
                  : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
