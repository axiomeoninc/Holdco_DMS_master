"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Calculator,
    Car,
    CreditCard,
    Edit,
    FileSignature,
    FileText,
    Loader2,
} from "lucide-react";
import DealFormModal from "@/src/components/DealFormModal";
import BillOfSaleModal from "@/src/components/BillOfSaleModal";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import {
    PropertyEmpty,
    PropertyList,
    PropertyRow,
    RecordNotes,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { RelationChip } from "@/src/components/ui/RelationChip";
import { apiFetch, ApiError } from "@/src/lib/fetch";
import { firstImageUrl } from "@/src/lib/vehicle-image";
import { toast } from "@/src/lib/toast";
import { formatCurrency } from "@/src/lib/utils";

interface Deal {
    id: string;
    vehicle_id: string | null;
    customer_id: string | null;
    deal_status: string;
    finance_term: number | null;
    interest_rate: number | null;
    down_payment: number;
    deposit_amount?: number | null;
    deposit_paid?: number | null;
    payment_status?: string | null;
    trade_in_value?: number | null;
    sale_price: number;
    salesperson_id: string | null;
    finance_company: string | null;
    notes: string | null;
    deal_date: string;
    created_at: string;
    updated_at?: string;
    warranty_package?: string | null;
    gap_coverage?: boolean;
    tire_coverage?: boolean;
    paint_protection?: boolean;
    extended_service?: boolean;
    admin_fee?: number | null;
    commission_rate?: number | null;
    commission_amount?: number | null;
    vehicle: {
        id: string;
        vin: string;
        year: number;
        make: string;
        model: string;
        retail_price: number;
        status: string;
        condition: string;
        image_gallery?: string[];
    } | null;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar: string | null;
        address?: string | null;
        city?: string | null;
        province?: string | null;
    } | null;
    salesperson: {
        id: string;
        full_name: string;
        email: string;
        avatar: string | null;
    } | null;
}

function formatDate(date: string | null | undefined) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatDateTime(date: string) {
    return new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function DealDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = typeof params?.id === "string" ? params.id : "";

    const [deal, setDeal] = useState<Deal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showBos, setShowBos] = useState(false);
    const [bosData, setBosData] = useState<Record<string, unknown> | null>(null);
    const [bosMode, setBosMode] = useState<"add" | "edit" | "view">("add");
    const [bosLoading, setBosLoading] = useState(false);
    const [statusSaving, setStatusSaving] = useState(false);

    const STATUS_CHIP_OPTIONS = [
        "Negotiation",
        "Down Payment",
        "Finance",
        "Paid Off",
        "Closed",
        "Cancelled",
    ] as const;

    async function load() {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const [dealRes, meRes] = await Promise.all([
                apiFetch<{ data: Deal }>(`/api/deals/${id}`),
                apiFetch<{
                    data: {
                        role?: string;
                        user_permissions?: string[];
                        effective_permissions?: string[];
                        is_platform_admin?: boolean;
                    };
                }>("/api/me", { silent: true }).catch(() => null),
            ]);
            setDeal(dealRes.data);
            if (meRes?.data) {
                const role = meRes.data.role || "";
                const perms =
                    meRes.data.effective_permissions ||
                    meRes.data.user_permissions ||
                    [];
                setCanEdit(
                    Boolean(meRes.data.is_platform_admin) ||
                        role === "Admin" ||
                        perms.includes("deals:write") ||
                        perms.includes("*")
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Deal not found");
            setDeal(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function openBillOfSale() {
        if (!deal) return;
        setBosLoading(true);
        try {
            const res = await apiFetch<{ data: Record<string, unknown>[] }>(
                `/api/bill-of-sale?deal_id=${deal.id}`,
                { silent: true }
            );
            if (res.data?.length) {
                const first = res.data[0] as Record<string, unknown> | undefined;
                setBosData(first ?? null);
                setBosMode("edit");
            } else {
                setBosData(null);
                setBosMode("add");
            }
            setShowBos(true);
        } catch {
            setBosData(null);
            setBosMode("add");
            setShowBos(true);
        } finally {
            setBosLoading(false);
        }
    }

    async function setDealStatus(next: string) {
        if (!deal || next === deal.deal_status || statusSaving) return;
        setStatusSaving(true);
        const prev = deal.deal_status;
        setDeal({ ...deal, deal_status: next });
        try {
            await apiFetch(`/api/deals/${deal.id}`, {
                method: "PATCH",
                body: { deal_status: next },
            });
            toast.success(`Status → ${next}`);
            void load();
        } catch (err) {
            setDeal({ ...deal, deal_status: prev });
            toast.error(
                err instanceof Error ? err.message : "Failed to update status"
            );
        } finally {
            setStatusSaving(false);
        }
    }

    /** Built-in payments: deposit capture via hosted Stripe checkout. */
    async function handleCollectDeposit() {
        if (!deal) return;
        try {
            const res = await apiFetch<{ data?: { url?: string } }>(
                "/api/payments/checkout",
                {
                    method: "POST",
                    body: {
                        reference_type: "deposit",
                        reference_id: deal.id,
                        success_path: `/deals/${deal.id}`,
                        cancel_path: `/deals/${deal.id}`,
                    },
                }
            );
            if (!res?.data?.url) {
                throw new Error("Checkout returned no URL");
            }
            window.location.href = res.data.url;
        } catch (err) {
            if (
                err instanceof ApiError &&
                ((err.data as { code?: string } | null)?.code ===
                    "PAYMENTS_NOT_CONFIGURED" ||
                    err.status === 409)
            ) {
                toast.error(
                    "Online payments are not configured yet — no charge was made."
                );
                return;
            }
            toast.error(
                err instanceof Error ? err.message : "Could not start payment"
            );
        }
    }

    const vehicleTitle = deal?.vehicle
        ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
        : "Deal";
    const thumb = deal?.vehicle
        ? firstImageUrl(deal.vehicle.image_gallery)
        : null;
    const fiProducts = [
        deal?.gap_coverage ? "GAP" : null,
        deal?.tire_coverage ? "Tire" : null,
        deal?.paint_protection ? "Paint" : null,
        deal?.extended_service ? "Extended service" : null,
    ].filter(Boolean);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (error || !deal) {
        return (
            <ListPageShell
                title="Deal"
                description={error || "Not found"}
                icon={FileText}
                breadcrumbs={[
                    { label: "Deals", href: "/deals" },
                    { label: "Detail" },
                ]}
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/deals")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to deals
                    </Button>
                }
            >
                <p className="text-sm text-destructive">{error || "Deal not found"}</p>
            </ListPageShell>
        );
    }

    return (
        <ListPageShell
            title={vehicleTitle}
            description={`Deal · ${deal.deal_status}`}
            icon={FileText}
            breadcrumbs={[
                { label: "Deals", href: "/deals" },
                { label: vehicleTitle },
            ]}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/deals")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    {canEdit && (
                        <Button
                            size="sm"
                            onClick={() => setShowEdit(true)}
                            leftIcon={<Edit className="h-3.5 w-3.5" />}
                        >
                            Edit
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={bosLoading}
                        onClick={() => void openBillOfSale()}
                        leftIcon={
                            bosLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FileSignature className="h-3.5 w-3.5" />
                            )
                        }
                    >
                        Bill of Sale
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const qs = new URLSearchParams();
                            qs.set("deal_id", deal.id);
                            qs.set("sale_price", String(deal.sale_price || 0));
                            qs.set(
                                "down_payment",
                                String(deal.down_payment || 0)
                            );
                            qs.set(
                                "trade_in_value",
                                String(deal.trade_in_value || 0)
                            );
                            if (deal.finance_term) {
                                qs.set(
                                    "term_months",
                                    String(deal.finance_term)
                                );
                            }
                            if (deal.interest_rate != null) {
                                qs.set(
                                    "interest_rate",
                                    String(deal.interest_rate)
                                );
                            }
                            if (deal.vehicle) {
                                qs.set(
                                    "vehicle",
                                    `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
                                );
                            }
                            if (deal.customer?.name) {
                                qs.set("customer", deal.customer.name);
                            }
                            router.push(`/finance?${qs.toString()}`);
                        }}
                        leftIcon={<Calculator className="h-3.5 w-3.5" />}
                    >
                        Desk F&I
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCollectDeposit()}
                        leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                    >
                        Collect deposit
                    </Button>
                    <Link
                        href={`/finance/credit/new?customer_id=${deal.customer_id || ""}&vehicle_id=${deal.vehicle_id || ""}`}
                        aria-label="Open credit application for this deal"
                    >
                        <Button variant="outline" size="sm">
                            Credit Application
                        </Button>
                    </Link>
                </div>
            }
        >
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div className="space-y-6">
                    {deal.vehicle && (
                        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                            {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={thumb}
                                    alt=""
                                    className="h-16 w-24 rounded-md border border-border object-cover"
                                />
                            ) : (
                                <div className="flex h-16 w-24 items-center justify-center rounded-md border border-border bg-muted">
                                    <Car className="h-6 w-6 text-muted-foreground" />
                                </div>
                            )}
                            <div>
                                <p className="font-medium text-foreground">
                                    {vehicleTitle}
                                </p>
                                <p className="font-mono text-xs text-muted-foreground">
                                    {deal.vehicle.vin || "—"}
                                </p>
                                <StatusBadge
                                    status={deal.deal_status}
                                    resource="deal"
                                />
                            </div>
                        </div>
                    )}

                    <PropertyList title="Deal">
                        <PropertyRow label="Status">
                            {canEdit ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {STATUS_CHIP_OPTIONS.map((s) => {
                                        const active = deal.deal_status === s;
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                disabled={statusSaving}
                                                onClick={() => void setDealStatus(s)}
                                                className={
                                                    active
                                                        ? "rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-white"
                                                        : "rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                                }
                                            >
                                                {s}
                                            </button>
                                        );
                                    })}
                                    {!STATUS_CHIP_OPTIONS.includes(
                                        deal.deal_status as (typeof STATUS_CHIP_OPTIONS)[number]
                                    ) ? (
                                        <StatusBadge
                                            status={deal.deal_status}
                                            resource="deal"
                                        />
                                    ) : null}
                                </div>
                            ) : (
                                <StatusBadge
                                    status={deal.deal_status}
                                    resource="deal"
                                />
                            )}
                        </PropertyRow>
                        <PropertyRow label="Customer">
                            {deal.customer ? (
                                <RelationChip
                                    customerId={deal.customer.id}
                                    name={deal.customer.name}
                                    avatarUrl={deal.customer.avatar ?? null}
                                />
                            ) : (
                                <PropertyEmpty label="Cash / unlinked" />
                            )}
                        </PropertyRow>
                        <PropertyRow label="Sale price">
                            {formatCurrency(deal.sale_price)}
                        </PropertyRow>
                        <PropertyRow label="Down payment">
                            {formatCurrency(deal.down_payment || 0)}
                        </PropertyRow>
                        <PropertyRow label="Trade-in">
                            {formatCurrency(deal.trade_in_value || 0)}
                        </PropertyRow>
                        <PropertyRow label="Finance">
                            {deal.finance_term
                                ? `${deal.finance_term} mo`
                                : "—"}
                            {deal.interest_rate != null
                                ? ` @ ${deal.interest_rate}%`
                                : ""}
                            {deal.finance_company
                                ? ` · ${deal.finance_company}`
                                : ""}
                        </PropertyRow>
                        <PropertyRow label="Salesperson">
                            {deal.salesperson?.full_name || (
                                <PropertyEmpty label="Unassigned" />
                            )}
                        </PropertyRow>
                        <PropertyRow label="Deal date">
                            {formatDate(deal.deal_date)}
                        </PropertyRow>
                        {(deal.warranty_package || fiProducts.length > 0) && (
                            <PropertyRow label="F&I products">
                                {[
                                    deal.warranty_package,
                                    ...fiProducts,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </PropertyRow>
                        )}
                        {(deal.commission_rate != null ||
                            deal.commission_amount != null) && (
                            <PropertyRow label="Commission">
                                {deal.commission_rate != null
                                    ? `${deal.commission_rate}%`
                                    : ""}
                                {deal.commission_amount != null
                                    ? ` · ${formatCurrency(deal.commission_amount)}`
                                    : ""}
                            </PropertyRow>
                        )}
                    </PropertyList>

                    {deal.notes?.trim() && (
                        <RecordNotes>{deal.notes}</RecordNotes>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                            Payment
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span className="font-medium text-foreground">
                                    {deal.payment_status || "Unpaid"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Deposit amount</span>
                                <span className="text-foreground">
                                    {formatCurrency(deal.deposit_amount || 0)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Deposit paid</span>
                                <span className="text-foreground">
                                    {formatCurrency(deal.deposit_paid || 0)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-border pt-2">
                                <span className="text-muted-foreground">Deposit balance</span>
                                <span className="font-semibold text-foreground">
                                    {formatCurrency(
                                        Math.max(
                                            0,
                                            (deal.deposit_amount || 0) -
                                                (deal.deposit_paid || 0)
                                        )
                                    )}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleCollectDeposit()}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                            >
                                <CreditCard className="h-4 w-4" />
                                Collect deposit
                            </button>
                            <p className="text-[11px] text-muted-foreground">
                                Hosted Stripe checkout. When payments are not
                                configured, no charge is made.
                            </p>
                        </div>
                    </div>

                    <ActivityTimeline
                        title="Activity"
                        items={[
                            {
                                id: "created",
                                title: "Deal created",
                                timestamp: formatDateTime(deal.created_at),
                            },
                            ...(deal.updated_at
                                ? [
                                      {
                                          id: "updated",
                                          title: "Last updated",
                                          timestamp: formatDateTime(
                                              deal.updated_at
                                          ),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </div>
            </div>

            {showEdit && (
                <DealFormModal
                    mode="edit"
                    deal={deal}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => {
                        setShowEdit(false);
                        void load();
                        toast.success("Deal updated");
                    }}
                />
            )}

            {showBos && (
                <BillOfSaleModal
                    mode={bosMode}
                    deal={deal}
                    billOfSale={bosData as never}
                    onClose={() => {
                        setShowBos(false);
                        setBosData(null);
                    }}
                    onSuccess={() => {
                        setShowBos(false);
                        setBosData(null);
                        void load();
                    }}
                />
            )}
        </ListPageShell>
    );
}
