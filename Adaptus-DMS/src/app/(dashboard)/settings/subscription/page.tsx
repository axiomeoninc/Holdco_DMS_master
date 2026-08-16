"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    CreditCard,
    CheckCircle,
    XCircle,
    Loader2,
    AlertCircle,
    RefreshCw,
    Zap,
    Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PaymentConfig {
    configured: boolean;
    provider: string | null;
    publishableKey: string | null;
    currency: string;
}

interface Subscription {
    id: string;
    dealership_id: string;
    plan_name: string;
    plan_price: number;
    billing_cycle: string;
    status: string;
    features: string[];
    limits: {
        users: number;
        vehicles: number;
        storage_gb: number;
    };
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
}

interface Dealership {
    id: string;
    name: string;
    status: string;
}

export default function SubscriptionPage() {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [dealership, setDealership] = useState<Dealership | null>(null);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);

            // First get user to find their dealership
            const meResponse = await fetch("/api/me", {
            });

            if (!meResponse.ok) {
                throw new Error("Failed to get user info");
            }

            const meData = await meResponse.json();
            const dealershipId = meData.data.dealership_id;
            const isPlatformAdmin = Boolean(meData.data?.is_platform_admin);

            if (!dealershipId) {
                if (isPlatformAdmin) {
                    setError(
                        "Platform admins without a home dealership manage plans under Platform → Subscriptions."
                    );
                } else {
                    setError("You are not associated with any dealership");
                }
                return;
            }

            // Get dealership details
            const dealershipResponse = await fetch(`/api/dealerships/${dealershipId}`, {
            });

            if (dealershipResponse.ok) {
                const dealershipData = await dealershipResponse.json();
                setDealership(dealershipData.data);
                setSubscription(dealershipData.data.subscription || null);
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
            console.error("Error fetching subscription:", err);
            setError(err instanceof Error ? err.message : "Failed to load subscription");
        } finally {
            setLoading(false);
        }
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
            Active: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
            Trial: { bg: "bg-blue-100", text: "text-blue-700", icon: Zap },
            PastDue: { bg: "bg-amber-100", text: "text-amber-700", icon: AlertCircle },
            Suspended: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
            Cancelled: { bg: "bg-gray-100", text: "text-gray-700", icon: XCircle }
        };
        const style = styles[status] || { bg: "bg-gray-100", text: "text-gray-700", icon: XCircle };
        const Icon = style.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${style.bg} ${style.text}`}>
                <Icon className="w-3 h-3" />
                {status}
            </span>
        );
    };

    const planFeatures = [
        { name: "Unlimited Vehicles", included: true },
        { name: "User Management", included: true },
        { name: "Customer Management", included: true },
        { name: "Lead Management", included: true },
        { name: "Deal Tracking", included: true },
        { name: "Invoice Generation", included: true },
        { name: "Expense Tracking", included: true },
        { name: "Financial Reports", included: true },
        { name: "Priority Support", included: subscription?.plan_name === "Premium" },
        { name: "API Access", included: subscription?.plan_name === "Premium" },
        { name: "Custom Branding", included: subscription?.plan_name === "Premium" },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        View your AdaptUs plan and customer checkout status
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                {paymentConfig ? (
                    paymentConfig.configured ? (
                    <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                        <p className="font-medium">
                            Stripe checkout is live ({paymentConfig.currency})
                        </p>
                        <p className="mt-0.5 text-xs text-green-900/90">
                            Collect customer payments from{" "}
                            <Link href="/invoices" className="underline">
                                Invoices
                            </Link>{" "}
                            and{" "}
                            <Link href="/deals" className="underline">
                                Deals
                            </Link>
                            . AdaptUs plan upgrades stay operator-managed — email support to
                            change this dealership&apos;s plan. Feature checklist below is product
                            capability, not a self-serve entitlement portal.
                        </p>
                    </div>
                    ) : (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        <p className="font-medium">
                            Online checkout disabled — Stripe is not configured
                        </p>
                        <p className="mt-0.5 text-xs text-amber-900/90">
                            No charges are made. Plan changes and payment enablement go through
                            AdaptUs. Email{" "}
                            <a
                                href="mailto:support@flashfender.com?subject=Subscription%20help"
                                className="underline"
                            >
                                support@flashfender.com
                            </a>{" "}
                            to change plans or turn on customer checkout.
                        </p>
                    </div>
                    )
                ) : null}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-600 space-y-1">
                            <p>{error}</p>
                            {error.includes("Platform → Subscriptions") && (
                                <Link
                                    href="/platform/subscriptions"
                                    className="inline-block font-medium underline text-red-700 hover:text-red-800"
                                >
                                    Open platform subscriptions
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Subscription Card */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-100 text-sm">Current Plan</p>
                                        <h2 className="text-2xl font-bold text-white mt-1">
                                            {subscription?.plan_name || "No Plan"}
                                        </h2>
                                    </div>
                                    {subscription && getStatusBadge(subscription.status)}
                                </div>
                            </div>

                            {/* Details */}
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Price */}
                                    <div>
                                        <p className="text-sm text-gray-500">Price</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {subscription ? formatCurrency(subscription.plan_price) : "$0"}
                                            <span className="text-sm font-normal text-gray-500">
                                                /{subscription?.billing_cycle || "month"}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Billing Cycle */}
                                    <div>
                                        <p className="text-sm text-gray-500">Billing Cycle</p>
                                        <p className="text-lg font-semibold text-gray-900 capitalize">
                                            {subscription?.billing_cycle || "N/A"}
                                        </p>
                                    </div>

                                    {/* Current Period Start */}
                                    <div>
                                        <p className="text-sm text-gray-500">Current Period Start</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {formatDate(subscription?.current_period_start ?? subscription?.trial_ends_at ?? null)}
                                        </p>
                                    </div>

                                    {/* Current Period End */}
                                    <div>
                                        <p className="text-sm text-gray-500">Current Period End</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {formatDate(subscription?.current_period_end ?? null)}
                                        </p>
                                    </div>
                                </div>

                                {/* Usage Limits */}
                                {subscription?.limits && (
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                        <h3 className="text-sm font-medium text-gray-900 mb-4">Usage Limits</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-2xl font-bold text-gray-900">
                                                    {subscription.limits.users}
                                                </p>
                                                <p className="text-sm text-gray-500">Users</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-2xl font-bold text-gray-900">
                                                    {subscription.limits.vehicles}
                                                </p>
                                                <p className="text-sm text-gray-500">Vehicles</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-2xl font-bold text-gray-900">
                                                    {subscription.limits.storage_gb} GB
                                                </p>
                                                <p className="text-sm text-gray-500">Storage</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Plan Features */}
                        <div className="bg-white rounded-xl border border-gray-200 mt-6">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900">Plan Features</h3>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {planFeatures.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            {feature.included ? (
                                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                            )}
                                            <span className={feature.included ? "text-gray-900" : "text-gray-400"}>
                                                {feature.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Dealership Info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-4">Dealership</h3>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{dealership?.name || "N/A"}</p>
                                    <p className="text-sm text-gray-500 capitalize">{dealership?.status || "N/A"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Billing Information Card */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-500">Billing Information</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                View billing on file and customer checkout status. AdaptUs plan
                                cards are operator-managed.
                            </p>
                            <Link
                                href="/settings/billing"
                                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <CreditCard className="w-4 h-4" />
                                Billing details
                            </Link>
                            {paymentConfig?.configured ? (
                                <Link
                                    href="/invoices"
                                    className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Collect a customer payment
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    title="Stripe is not configured — no checkout session can be created and no charge is made"
                                    className="mt-2 w-full px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                                >
                                    Checkout disabled
                                </button>
                            )}
                        </div>

                        {/* Help Card */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
                            <h3 className="text-sm font-medium text-amber-800 mb-2">Need Help?</h3>
                            <p className="text-sm text-amber-700 mb-4">
                                Email AdaptUs to change this dealership&apos;s plan, seats, or
                                trial. Self-serve SaaS checkout is not offered.
                            </p>
                            <a
                                href="mailto:support@flashfender.com?subject=Subscription%20help"
                                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                Email support@flashfender.com
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
