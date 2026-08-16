"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    CreditCard,
    Building2,
    Mail,
    Phone,
    Loader2,
    AlertCircle,
    RefreshCw,
} from "lucide-react";

interface BillingInfo {
    id: string;
    dealership_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    payment_method_type: string | null;
    payment_method_last4: string | null;
    payment_method_brand: string | null;
    billing_name: string | null;
    billing_email: string | null;
    billing_phone: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_province: string | null;
    billing_postal_code: string | null;
    billing_country: string | null;
    tax_exempt: boolean;
    tax_id: string | null;
}

interface Dealership {
    id: string;
    name: string;
    status: string;
}

interface PaymentConfig {
    configured: boolean;
    provider: string | null;
    publishableKey: string | null;
    currency: string;
}

export default function BillingPage() {
    const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
    const [dealership, setDealership] = useState<Dealership | null>(null);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(
        null
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);

            const meResponse = await fetch("/api/me");

            if (!meResponse.ok) {
                throw new Error("Failed to get user info");
            }

            const meData = await meResponse.json();
            const dealershipId = meData.data.dealership_id;

            if (!dealershipId) {
                setError("You are not associated with any dealership");
                return;
            }

            const dealershipResponse = await fetch(
                `/api/dealerships/${dealershipId}`
            );

            if (dealershipResponse.ok) {
                const dealershipData = await dealershipResponse.json();
                setDealership(dealershipData.data);

                if (dealershipData.data.billing_information) {
                    setBillingInfo(dealershipData.data.billing_information);
                } else {
                    setBillingInfo(null);
                }
            }

            const paymentsResponse = await fetch("/api/payments/config");
            if (paymentsResponse.ok) {
                const paymentsJson = await paymentsResponse.json();
                setPaymentConfig(paymentsJson.data || null);
            } else {
                setPaymentConfig({
                    configured: false,
                    provider: null,
                    publishableKey: null,
                    currency: "CAD",
                });
            }
        } catch (err: unknown) {
            console.error("Error fetching billing info:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load billing information"
            );
        } finally {
            setLoading(false);
        }
    }

    const paymentsReady = Boolean(paymentConfig?.configured);
    const currency = paymentConfig?.currency || "CAD";

    const formatCardDisplay = () => {
        if (!billingInfo?.payment_method_type) return null;
        return (
            <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
                <div className="flex h-8 w-12 items-center justify-center rounded bg-gray-200">
                    <CreditCard className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                    <p className="font-medium text-gray-900">
                        {billingInfo.payment_method_brand ||
                            billingInfo.payment_method_type}{" "}
                        ending in {billingInfo.payment_method_last4}
                    </p>
                    {billingInfo.stripe_subscription_id && (
                        <p className="text-sm text-gray-500">
                            AdaptUs plan record on file — plan changes are
                            operator-managed.
                        </p>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Billing on file and customer checkout status.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchData()}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            <div className="px-6 py-6">
                {paymentsReady ? (
                    <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                        <p className="font-medium">
                            Stripe checkout is live ({currency})
                        </p>
                        <p className="mt-0.5 text-xs text-green-900/90">
                            Collect invoice balances, deal deposits, and bill of
                            sale balances via hosted Stripe Checkout. No charge
                            is made until the customer completes checkout.{" "}
                            <Link href="/invoices" className="underline">
                                Open Invoices
                            </Link>{" "}
                            or a{" "}
                            <Link href="/deals" className="underline">
                                deal
                            </Link>{" "}
                            to start payment.
                        </p>
                    </div>
                ) : (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        <p className="font-medium">
                            Online checkout disabled — Stripe is not configured
                        </p>
                        <p className="mt-0.5 text-xs text-amber-900/90">
                            No charges are made and no card details are
                            collected. Customer Pay buttons stay off until
                            Stripe is enabled for this environment. Email{" "}
                            <a
                                href="mailto:support@flashfender.com?subject=Enable%20Stripe%20payments"
                                className="underline"
                            >
                                support@flashfender.com
                            </a>{" "}
                            to turn on payments or update AdaptUs plan billing.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Billing Information
                                </h2>
                            </div>

                            <div className="p-6">
                                {billingInfo?.billing_name ||
                                billingInfo?.billing_address_line1 ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <Building2 className="mt-0.5 h-5 w-5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {billingInfo.billing_name ||
                                                        dealership?.name}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {billingInfo.billing_address_line1 ||
                                                        "No address set"}
                                                </p>
                                                {billingInfo.billing_address_line2 && (
                                                    <p className="text-sm text-gray-500">
                                                        {
                                                            billingInfo.billing_address_line2
                                                        }
                                                    </p>
                                                )}
                                                <p className="text-sm text-gray-500">
                                                    {[
                                                        billingInfo.billing_city,
                                                        billingInfo.billing_province,
                                                        billingInfo.billing_postal_code,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(", ")}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {billingInfo.billing_country}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <Mail className="mt-0.5 h-5 w-5 text-gray-400" />
                                            <p className="text-sm text-gray-600">
                                                {billingInfo.billing_email ||
                                                    "No email set"}
                                            </p>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <Phone className="mt-0.5 h-5 w-5 text-gray-400" />
                                            <p className="text-sm text-gray-600">
                                                {billingInfo.billing_phone ||
                                                    "No phone set"}
                                            </p>
                                        </div>

                                        <a
                                            href="mailto:support@flashfender.com?subject=Update%20billing%20address"
                                            className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
                                        >
                                            <Mail className="h-4 w-4" />
                                            Request address update
                                        </a>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <Building2 className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                                        <p className="mb-2 text-gray-500">
                                            No billing information on file
                                        </p>
                                        <p className="mx-auto mb-4 max-w-sm text-xs text-gray-400">
                                            Dealership address on the AdaptUs
                                            subscription is operator-managed.
                                            Email AdaptUs to add billing
                                            details.
                                        </p>
                                        <a
                                            href="mailto:support@flashfender.com?subject=Add%20billing%20info"
                                            className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
                                        >
                                            <Mail className="h-4 w-4" />
                                            Email billing support
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Payment Methods
                                </h2>
                                <span
                                    title="AdaptUs plan cards are operator-managed; customer cards are collected at Stripe Checkout"
                                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-400"
                                >
                                    Add Card (operator-managed)
                                </span>
                            </div>

                            <div className="p-6">
                                {billingInfo?.payment_method_type ? (
                                    <div className="space-y-3">
                                        {formatCardDisplay()}
                                        <p className="text-xs text-gray-400">
                                            This card is on the AdaptUs
                                            subscription record. Customer
                                            payments use hosted Stripe Checkout
                                            from Invoices or Deals — they do not
                                            store a card here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <CreditCard className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                                        <p className="mb-2 text-gray-500">
                                            No AdaptUs payment method on file
                                        </p>
                                        <p className="mx-auto mb-4 max-w-sm text-xs text-gray-400">
                                            Self-serve card capture for the
                                            dealership plan is not available.
                                            Customer checkout does not require a
                                            card saved here.
                                        </p>
                                        <a
                                            href="mailto:support@flashfender.com?subject=Add%20payment%20method"
                                            className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
                                        >
                                            <Mail className="h-4 w-4" />
                                            Email to add a plan card
                                        </a>
                                    </div>
                                )}

                                <div className="mt-6 border-t border-gray-100 pt-6">
                                    <h3 className="mb-2 text-sm font-medium text-gray-900">
                                        Collect a customer payment
                                    </h3>
                                    {paymentsReady ? (
                                        <div className="flex flex-wrap gap-2">
                                            <Link
                                                href="/invoices"
                                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                            >
                                                <CreditCard className="h-4 w-4" />
                                                Pay from Invoices
                                            </Link>
                                            <Link
                                                href="/deals"
                                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                            >
                                                Deal deposits
                                            </Link>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled
                                            title="Stripe is not configured — no checkout session can be created and no charge is made"
                                            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
                                        >
                                            <CreditCard className="h-4 w-4" />
                                            Checkout disabled
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-4 text-sm font-medium text-gray-500">
                                Dealership
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {dealership?.name || "N/A"}
                                    </p>
                                    <p className="text-sm capitalize text-gray-500">
                                        {dealership?.status || "N/A"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-4 text-sm font-medium text-gray-500">
                                Current Subscription
                            </h3>
                            <Link
                                href="/settings/subscription"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
                            >
                                View Subscription
                            </Link>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                                <CreditCard className="h-4 w-4" />
                                Online Payments
                            </h3>
                            {paymentConfig ? (
                                paymentConfig.configured ? (
                                    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
                                        <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                                        <p>
                                            Payments are live via Stripe (
                                            {paymentConfig.currency}). Invoices
                                            and deal deposits can be collected
                                            online.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                                        <p className="font-medium">
                                            Payments not configured
                                        </p>
                                        <p className="mt-0.5 text-xs text-amber-900/90">
                                            Checkout stays disabled. Nothing is
                                            charged until Stripe is set up for
                                            this environment.
                                        </p>
                                    </div>
                                )
                            ) : (
                                <p className="text-sm text-gray-400">
                                    Checking configuration…
                                </p>
                            )}
                            <p className="mt-2 text-[11px] text-gray-400">
                                Collect invoice balances and deal deposits via
                                hosted checkout. Payments appear on{" "}
                                <Link
                                    href="/settings/accounting"
                                    className="underline"
                                >
                                    Accounting export
                                </Link>{" "}
                                and the{" "}
                                <Link href="/settings/audit" className="underline">
                                    audit trail
                                </Link>
                                .
                            </p>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
                            <h3 className="mb-2 text-sm font-medium text-amber-800">
                                Billing Help
                            </h3>
                            <p className="mb-4 text-sm text-amber-700">
                                Plan changes, tax IDs, and saved cards on the
                                AdaptUs subscription are handled by support.
                            </p>
                            <a
                                href="mailto:support@flashfender.com?subject=Billing%20help"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200"
                            >
                                <Mail className="h-4 w-4" />
                                Email support@flashfender.com
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
