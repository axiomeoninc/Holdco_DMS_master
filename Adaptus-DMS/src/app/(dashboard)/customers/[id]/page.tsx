"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Edit,
    Loader2,
    Mail,
    Phone,
    UserRound,
    ShieldCheck,
    ShieldOff,
} from "lucide-react";
import CustomerFormModal from "@/src/components/CustomerFormModal";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import {
    PropertyEmpty,
    PropertyList,
    PropertyRow,
    RecordNotes,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { apiFetch } from "@/src/lib/fetch";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    notes: string | null;
    avatar: string | null;
    status?: string | null;
    source?: string | null;
    company?: string | null;
    marketing_consent?: boolean | null;
    sms_consent?: boolean | null;
    marketing_consent_at?: string | null;
    sms_consent_at?: string | null;
    created_at: string;
    updated_at: string;
}

interface RelatedBucket {
    count: number;
    items: Array<Record<string, unknown>>;
}

interface RelatedPayload {
    deals: RelatedBucket;
    leads: RelatedBucket;
    invoices: RelatedBucket;
    test_drives: RelatedBucket;
    follow_ups: RelatedBucket;
}

function formatDateTime(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function ConsentBadge({
    granted,
    at,
    label,
}: {
    granted: boolean;
    at?: string | null;
    label: string;
}) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            {granted ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
                <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                    {label}: {granted ? "Granted" : "Not granted"}
                </p>
                <p className="text-xs text-muted-foreground">
                    {granted && at
                        ? `Recorded ${formatDateTime(at)}`
                        : "Unchecked by default (CASL)"}
                </p>
            </div>
        </div>
    );
}

function RelatedSection({
    title,
    href,
    bucket,
    renderItem,
}: {
    title: string;
    href: string;
    bucket: RelatedBucket;
    renderItem: (row: Record<string, unknown>) => string;
}) {
    const router = useRouter();
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                    {title}{" "}
                    <span className="font-normal text-muted-foreground">
                        ({bucket.count})
                    </span>
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(href)}
                >
                    Open
                </Button>
            </div>
            {bucket.count === 0 ? (
                <p className="text-xs text-muted-foreground">None linked</p>
            ) : (
                <ul className="space-y-1.5">
                    {bucket.items.map((row) => (
                        <li
                            key={String(row.id)}
                            className="truncate rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-foreground/90"
                        >
                            {renderItem(row)}
                        </li>
                    ))}
                    {bucket.count > bucket.items.length && (
                        <li className="text-xs text-muted-foreground">
                            +{bucket.count - bucket.items.length} more
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = typeof params?.id === "string" ? params.id : "";

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [related, setRelated] = useState<RelatedPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [showEdit, setShowEdit] = useState(false);

    async function load() {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const [custRes, relatedRes, meRes] = await Promise.all([
                apiFetch<{ data: Customer }>(`/api/customers/${id}`),
                apiFetch<{ data: RelatedPayload }>(
                    `/api/customers/${id}/related`,
                    { silent: true }
                ).catch(() => null),
                apiFetch<{
                    data: {
                        role?: string;
                        user_permissions?: string[];
                        effective_permissions?: string[];
                        is_platform_admin?: boolean;
                    };
                }>("/api/me", { silent: true }).catch(() => null),
            ]);
            setCustomer(custRes.data);
            setRelated(relatedRes?.data || null);
            if (meRes?.data) {
                const role = meRes.data.role || "";
                const perms =
                    meRes.data.effective_permissions ||
                    meRes.data.user_permissions ||
                    [];
                setCanEdit(
                    Boolean(meRes.data.is_platform_admin) ||
                        role === "Admin" ||
                        role === "Manager" ||
                        perms.includes("customers:write") ||
                        perms.includes("*")
                );
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Customer not found"
            );
            setCustomer(null);
            setRelated(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const addressLine = customer
        ? [customer.city, customer.province, customer.postal_code]
              .filter(Boolean)
              .join(", ")
        : "";

    return (
        <ListPageShell
            title={customer?.name || "Customer"}
            description="Customer 360"
            icon={UserRound}
            breadcrumbs={[
                { label: "Customers", href: "/customers" },
                { label: customer?.name || "Detail" },
            ]}
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/customers")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Directory
                    </Button>
                    {canEdit && customer && (
                        <Button size="sm" onClick={() => setShowEdit(true)}>
                            <Edit className="h-4 w-4" />
                            Edit
                        </Button>
                    )}
                </div>
            }
        >
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : error || !customer ? (
                <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        {error || "Customer not found"}
                    </p>
                    <Button
                        className="mt-4"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/customers")}
                    >
                        Back to directory
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div className="space-y-6 rounded-lg border border-border bg-card p-5">
                        <div className="flex flex-wrap gap-2">
                            {customer.phone && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<Phone className="h-3.5 w-3.5" />}
                                    onClick={() => {
                                        window.location.href = `tel:${customer.phone}`;
                                    }}
                                >
                                    Call
                                </Button>
                            )}
                            {customer.email && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<Mail className="h-3.5 w-3.5" />}
                                    onClick={() => {
                                        window.location.href = `mailto:${customer.email}`;
                                    }}
                                >
                                    Email
                                </Button>
                            )}
                        </div>

                        <PropertyList title="Profile">
                            <PropertyRow label="Status">
                                {customer.status?.trim() || <PropertyEmpty />}
                            </PropertyRow>
                            <PropertyRow label="Source">
                                {customer.source?.trim() || <PropertyEmpty />}
                            </PropertyRow>
                        </PropertyList>

                        <PropertyList title="Contact">
                            <PropertyRow label="Email">
                                {customer.email?.trim() ? (
                                    <a
                                        href={`mailto:${customer.email}`}
                                        className="text-primary hover:underline"
                                    >
                                        {customer.email}
                                    </a>
                                ) : (
                                    <PropertyEmpty />
                                )}
                            </PropertyRow>
                            <PropertyRow label="Phone">
                                {customer.phone?.trim() ? (
                                    <a
                                        href={`tel:${customer.phone}`}
                                        className="text-primary hover:underline"
                                    >
                                        {customer.phone}
                                    </a>
                                ) : (
                                    <PropertyEmpty />
                                )}
                            </PropertyRow>
                            <PropertyRow label="Street">
                                {customer.address?.trim() ? (
                                    customer.address
                                ) : (
                                    <PropertyEmpty />
                                )}
                            </PropertyRow>
                            <PropertyRow label="City / region">
                                {addressLine || <PropertyEmpty />}
                            </PropertyRow>
                        </PropertyList>

                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-foreground">
                                Communication consent (CASL)
                            </h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <ConsentBadge
                                    label="Marketing email"
                                    granted={Boolean(customer.marketing_consent)}
                                    at={customer.marketing_consent_at}
                                />
                                <ConsentBadge
                                    label="SMS / text"
                                    granted={Boolean(customer.sms_consent)}
                                    at={customer.sms_consent_at}
                                />
                            </div>
                        </div>

                        {customer.notes?.trim() && (
                            <RecordNotes>{customer.notes}</RecordNotes>
                        )}

                        <ActivityTimeline
                            items={[
                                {
                                    id: "created",
                                    title: "Created",
                                    timestamp: formatDateTime(customer.created_at),
                                },
                                {
                                    id: "updated",
                                    title: "Last updated",
                                    timestamp: formatDateTime(customer.updated_at),
                                },
                            ]}
                        />
                    </div>

                    <div className="space-y-5 rounded-lg border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold text-foreground">
                            Related activity
                        </h2>
                        {!related ? (
                            <p className="text-xs text-muted-foreground">
                                Related activity unavailable
                            </p>
                        ) : (
                            <>
                                <RelatedSection
                                    title="Deals"
                                    href="/deals"
                                    bucket={related.deals}
                                    renderItem={(r) =>
                                        `${String(r.status || "Deal")}${
                                            r.sale_price != null
                                                ? ` · $${Number(r.sale_price).toLocaleString()}`
                                                : ""
                                        }`
                                    }
                                />
                                <RelatedSection
                                    title="Leads"
                                    href="/leads"
                                    bucket={related.leads}
                                    renderItem={(r) =>
                                        `${String(r.status || "Lead")}${
                                            r.source ? ` · ${String(r.source)}` : ""
                                        }`
                                    }
                                />
                                <RelatedSection
                                    title="Invoices"
                                    href="/invoices"
                                    bucket={related.invoices}
                                    renderItem={(r) =>
                                        `${String(r.invoice_number || r.id)}${
                                            r.status ? ` · ${String(r.status)}` : ""
                                        }`
                                    }
                                />
                                <RelatedSection
                                    title="Test drives"
                                    href="/test-drives"
                                    bucket={related.test_drives}
                                    renderItem={(r) =>
                                        `${String(r.status || "Test drive")}${
                                            r.scheduled_at
                                                ? ` · ${formatDateTime(String(r.scheduled_at))}`
                                                : ""
                                        }`
                                    }
                                />
                                <RelatedSection
                                    title="Follow-ups"
                                    href="/follow-ups"
                                    bucket={related.follow_ups}
                                    renderItem={(r) =>
                                        `${String(r.type || "Follow-up")}${
                                            r.status ? ` · ${String(r.status)}` : ""
                                        }`
                                    }
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {showEdit && customer && (
                <CustomerFormModal
                    mode="edit"
                    customer={customer}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => {
                        setShowEdit(false);
                        void load();
                    }}
                />
            )}
        </ListPageShell>
    );
}
