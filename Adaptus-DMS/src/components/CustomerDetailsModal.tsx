"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Edit,
    ExternalLink,
    Loader2,
    Mail,
    Phone,
    ShieldCheck,
    ShieldOff,
} from "lucide-react";
import { RecordDrawer } from "@/src/components/ui/RecordDrawer";
import { RecordHeader } from "@/src/components/ui/RecordHeader";
import {
    PropertyList,
    PropertyRow,
    PropertyEmpty,
    RecordNotes,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { Button } from "@/src/components/ui/Button";
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

interface CustomerDetailsModalProps {
    customer: Customer;
    onClose: () => void;
    onEdit: () => void;
    userRole?: string;
    userPermissions?: string[];
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

export default function CustomerDetailsModal({
    customer: seed,
    onClose,
    onEdit,
    userRole,
    userPermissions = [],
}: CustomerDetailsModalProps) {
    const router = useRouter();
    const canEdit =
        userRole === "Admin" ||
        userRole === "Manager" ||
        userPermissions.includes("customers:write") ||
        userPermissions.includes("*");

    const [customer, setCustomer] = useState<Customer>(seed);
    const [related, setRelated] = useState<RelatedPayload | null>(null);
    const [loadingRelated, setLoadingRelated] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingRelated(true);
            try {
                const [full, rel] = await Promise.all([
                    apiFetch<{ data: Customer }>(`/api/customers/${seed.id}`, {
                        silent: true,
                    }).catch(() => null),
                    apiFetch<{ data: RelatedPayload }>(
                        `/api/customers/${seed.id}/related`,
                        { silent: true }
                    ).catch(() => null),
                ]);
                if (cancelled) return;
                if (full?.data) setCustomer(full.data);
                setRelated(rel?.data || null);
            } finally {
                if (!cancelled) setLoadingRelated(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [seed.id]);

    const name = customer.name?.trim() || null;
    const email = customer.email?.trim() || null;
    const phone = customer.phone?.trim() || null;
    const addressLine = [customer.city, customer.province, customer.postal_code]
        .filter(Boolean)
        .join(", ");

    const relatedSummary = related
        ? [
              related.deals.count && `${related.deals.count} deals`,
              related.leads.count && `${related.leads.count} leads`,
              related.invoices.count && `${related.invoices.count} invoices`,
              related.test_drives.count &&
                  `${related.test_drives.count} test drives`,
              related.follow_ups.count &&
                  `${related.follow_ups.count} follow-ups`,
          ]
              .filter(Boolean)
              .join(" · ")
        : "";

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={name ?? "Customer"}
                    avatarSrc={customer.avatar}
                    avatarName={name}
                />
            }
            actions={
                <>
                    {canEdit && (
                        <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Edit className="h-3.5 w-3.5" />}
                            onClick={onEdit}
                        >
                            Edit
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                        onClick={() => {
                            onClose();
                            router.push(`/customers/${customer.id}`);
                        }}
                    >
                        Full 360
                    </Button>
                    {phone && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Phone className="h-3.5 w-3.5" />}
                            onClick={() => {
                                window.location.href = `tel:${phone}`;
                            }}
                        >
                            Call
                        </Button>
                    )}
                    {email && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Mail className="h-3.5 w-3.5" />}
                            onClick={() => {
                                window.location.href = `mailto:${email}`;
                            }}
                        >
                            Email
                        </Button>
                    )}
                </>
            }
            footer={
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
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
                        {email ? (
                            <a href={`mailto:${email}`} className="text-primary hover:underline">
                                {email}
                            </a>
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Phone">
                        {phone ? (
                            <a href={`tel:${phone}`} className="text-primary hover:underline">
                                {phone}
                            </a>
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Street">
                        {customer.address?.trim() ? customer.address : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="City / region">
                        {addressLine || <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Consent (CASL)</h3>
                    <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                            {customer.marketing_consent ? (
                                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                            ) : (
                                <ShieldOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            )}
                            <span>
                                Marketing email:{" "}
                                {customer.marketing_consent ? "Granted" : "Not granted"}
                                {customer.marketing_consent_at
                                    ? ` · ${formatDateTime(customer.marketing_consent_at)}`
                                    : ""}
                            </span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                            {customer.sms_consent ? (
                                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                            ) : (
                                <ShieldOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            )}
                            <span>
                                SMS: {customer.sms_consent ? "Granted" : "Not granted"}
                                {customer.sms_consent_at
                                    ? ` · ${formatDateTime(customer.sms_consent_at)}`
                                    : ""}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Related</h3>
                    {loadingRelated ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading activity…
                        </div>
                    ) : relatedSummary ? (
                        <p className="text-sm text-foreground/85">{relatedSummary}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground">No linked activity</p>
                    )}
                </div>

                {customer.notes?.trim() && <RecordNotes>{customer.notes}</RecordNotes>}

                <ActivityTimeline
                    items={[
                        { id: "created", title: "Created", timestamp: formatDateTime(customer.created_at) },
                        { id: "updated", title: "Last updated", timestamp: formatDateTime(customer.updated_at) },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
