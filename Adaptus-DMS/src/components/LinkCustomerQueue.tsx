"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Loader2, UserPlus, X } from "lucide-react";
import CustomerFormModal from "@/src/components/CustomerFormModal";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface UnlinkedDeal {
    id: string;
    sale_price: number;
    deal_status: string;
    deal_date: string;
    vehicle: {
        id: string;
        year: number;
        make: string;
        model: string;
        vin: string;
        stock_number?: string | null;
    } | null;
}

interface LinkCustomerQueueProps {
    open: boolean;
    onClose: () => void;
    onLinked: () => void;
}

/** Guidance from QA_DEAL_RELINK / STAFF worksheet — display only, do not invent buyers. */
const NAMED_HINTS: Record<
    string,
    { hillzName: string; reason: string; cleanSuggestion: string }
> = {
    WAUSGAFC2CN002204: {
        hillzName: "JENA-LEIGH DIANNA RIETZE",
        reason: "named_unmatched",
        cleanSuggestion: "Jena-Leigh Dianna Rietze",
    },
    "3VWE57BUXKM038459": {
        hillzName: "JAGMEET JATTANA",
        reason: "named_unmatched",
        cleanSuggestion: "Jagmeet Jattana",
    },
    JN1EV7BR9PM543560: {
        hillzName: "charan",
        reason: "named_unmatched",
        cleanSuggestion: "Charan",
    },
    "1G1ZE5ST0PF183610": {
        hillzName: "sukhjit",
        reason: "named_unmatched",
        cleanSuggestion: "Sukhjit",
    },
    "3MW89FF03R8E57646": {
        hillzName: "manpreet250)891-2720",
        reason: "phone_garbage",
        cleanSuggestion: "Manpreet",
    },
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(amount || 0);
}

export default function LinkCustomerQueue({
    open,
    onClose,
    onLinked,
}: LinkCustomerQueueProps) {
    useOverlayDismiss(onClose, { open });

    const [deals, setDeals] = useState<UnlinkedDeal[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [linkingId, setLinkingId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Record<string, string>>({});
    const [count, setCount] = useState(0);
    const [filter, setFilter] = useState<"named" | "all">("named");
    const [createForDeal, setCreateForDeal] = useState<UnlinkedDeal | null>(
        null
    );
    const [dismissedCash, setDismissedCash] = useState<Record<string, true>>(
        {}
    );

    async function load() {
        setLoading(true);
        try {
            const [dealsRes, customersRes] = await Promise.all([
                apiFetch<{ data: UnlinkedDeal[]; count: number }>(
                    "/api/deals?unlinked=true&limit=80"
                ),
                apiFetch<{ data: Customer[] }>("/api/customers?limit=500"),
            ]);
            setDeals(dealsRes?.data || []);
            setCount(dealsRes?.count || 0);
            setCustomers(customersRes?.data || []);
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to load unlinked deals"
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (open) void load();
    }, [open]);

    const visibleDeals = useMemo(() => {
        const base = deals.filter((d) => !dismissedCash[d.id]);
        if (filter === "all") return base;
        return base.filter((d) => {
            const vin = d.vehicle?.vin;
            return Boolean(vin && NAMED_HINTS[vin]);
        });
    }, [deals, filter, dismissedCash]);

    const namedCount = useMemo(
        () =>
            deals.filter((d) => d.vehicle?.vin && NAMED_HINTS[d.vehicle.vin])
                .length,
        [deals]
    );

    async function linkDeal(dealId: string, customerId?: string) {
        const cid = customerId || selected[dealId];
        if (!cid) {
            toast.error("Select a customer first");
            return;
        }
        setLinkingId(dealId);
        try {
            await apiFetch(`/api/deals/${dealId}`, {
                method: "PATCH",
                body: { customer_id: cid },
            });
            toast.success("Customer linked");
            onLinked();
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Link failed");
        } finally {
            setLinkingId(null);
        }
    }

    const leaveCashBlank = (dealId: string) => {
        setDismissedCash((prev) => ({ ...prev, [dealId]: true }));
        toast.success(
            "Left unlinked",
            "Cash/blank stays null — no invented buyer."
        );
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-warning-50 p-2 text-warning">
                                <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">
                                    Link customers
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {count} unlinked · {namedCount} named
                                    leftovers (worksheet). Cash/blank → leave
                                    null.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 hover:bg-muted"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="flex gap-2 border-b border-border px-5 py-3">
                        <Button
                            size="sm"
                            variant={filter === "named" ? "primary" : "outline"}
                            onClick={() => setFilter("named")}
                        >
                            Named ({namedCount})
                        </Button>
                        <Button
                            size="sm"
                            variant={filter === "all" ? "primary" : "outline"}
                            onClick={() => setFilter("all")}
                        >
                            All unlinked ({count})
                        </Button>
                    </div>

                    <div className="space-y-3 p-5">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : visibleDeals.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                {filter === "named"
                                    ? "No named leftovers in this page of unlinked deals. Switch to All, or they are already linked."
                                    : "All deals have customers linked (or were dismissed as cash)."}
                            </p>
                        ) : (
                            visibleDeals.map((deal) => {
                                const vin = deal.vehicle?.vin || "";
                                const hint = vin ? NAMED_HINTS[vin] : undefined;
                                return (
                                    <div
                                        key={deal.id}
                                        className="rounded-xl border border-border bg-background p-3 space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">
                                                    {deal.vehicle
                                                        ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                                        : "No vehicle"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {deal.deal_status} ·{" "}
                                                    {formatCurrency(
                                                        deal.sale_price
                                                    )}
                                                    {vin ? ` · ${vin}` : ""}
                                                </p>
                                                {hint && (
                                                    <p className="mt-1 text-xs text-amber-800">
                                                        Hillz name:{" "}
                                                        <span className="font-medium">
                                                            {hint.hillzName}
                                                        </span>
                                                        {" · "}
                                                        {hint.reason} — create
                                                        or link a real customer
                                                        (suggested:{" "}
                                                        {hint.cleanSuggestion})
                                                    </p>
                                                )}
                                                {!hint && filter === "all" && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Cash/blank in source —
                                                        leave unlinked unless
                                                        you have a real buyer.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                            <select
                                                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                                                value={selected[deal.id] || ""}
                                                onChange={(e) =>
                                                    setSelected((prev) => ({
                                                        ...prev,
                                                        [deal.id]:
                                                            e.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="">
                                                    Select existing customer…
                                                </option>
                                                {customers.map((c) => (
                                                    <option
                                                        key={c.id}
                                                        value={c.id}
                                                    >
                                                        {c.name}
                                                        {c.phone
                                                            ? ` · ${c.phone}`
                                                            : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button
                                                size="sm"
                                                disabled={
                                                    linkingId === deal.id ||
                                                    !selected[deal.id]
                                                }
                                                onClick={() =>
                                                    void linkDeal(deal.id)
                                                }
                                            >
                                                {linkingId === deal.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Link2 className="h-4 w-4" />
                                                )}
                                                Link
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setCreateForDeal(deal)
                                                }
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                Create &amp; link
                                            </Button>
                                            {!hint && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        leaveCashBlank(deal.id)
                                                    }
                                                >
                                                    Leave cash/blank
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {createForDeal && (
                <CustomerFormModal
                    mode="add"
                    defaultName={
                        createForDeal.vehicle?.vin
                            ? NAMED_HINTS[createForDeal.vehicle.vin]
                                  ?.cleanSuggestion
                            : undefined
                    }
                    onClose={() => setCreateForDeal(null)}
                    onSuccess={() => setCreateForDeal(null)}
                    onSaved={(customer) => {
                        const dealId = createForDeal.id;
                        setCreateForDeal(null);
                        void linkDeal(dealId, customer.id);
                    }}
                />
            )}
        </div>
    );
}
