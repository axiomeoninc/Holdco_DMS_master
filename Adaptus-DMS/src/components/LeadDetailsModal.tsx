"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, FileText, Loader2, Mail, Phone, PhoneCall } from "lucide-react";
import { RecordDrawer } from "@/src/components/ui/RecordDrawer";
import { RecordHeader } from "@/src/components/ui/RecordHeader";
import {
    PropertyList,
    PropertyRow,
    PropertyEmpty,
    RecordNotes,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { LeadEmailSequencePanel } from "@/src/components/LeadEmailSequencePanel";
import { AiActionButton } from "@/src/components/ai/AiActionButton";
import { LeadScoreExplanation } from "@/src/components/LeadScoreExplanation";
import { AfterHoursPanel } from "@/src/components/AfterHoursPanel";
import { apiFetch, ApiError } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import {
    resolveLeadScore,
    temperatureClass,
} from "@/src/lib/business/lead-score";
import { canCreate, canEdit } from "@/src/lib/permission-middleware";
import { cn } from "@/src/lib/utils";

interface Lead {
    id: string;
    customer_id: string;
    source: string;
    status: string;
    interest_vehicle_id: string | null;
    assigned_to: string | null;
    notes: string | null;
    lead_creation_date: string;
    last_engagement: string;
    created_at: string;
    updated_at: string;
    score?: number | null;
    temperature?: string | null;
    converted_deal_id?: string | null;
    ai_why?: string | null;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar: string | null;
    } | null;
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
    } | null;
    assigned_user: {
        id: string;
        full_name: string;
        email: string;
        avatar: string | null;
    } | null;
}

interface LeadDetailsModalProps {
    lead: Lead;
    onClose: () => void;
    onEdit: () => void;
    onRefresh?: () => void;
    userRole?: string;
    userPermissions?: string[];
}

/** Surface a year+make+model string from notes when interest vehicle is unset. */
function parseVehicleFromNotes(notes: string | null): string | null {
    if (!notes?.trim()) return null;
    const match = notes.match(
        /\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9\-]+)\s+([A-Za-z0-9][A-Za-z0-9\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9\-]*){0,3})\b/
    );
    if (!match) return null;
    return `${match[1]} ${match[2]} ${match[3]}`.replace(/\s+/g, " ").trim();
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

export default function LeadDetailsModal({
    lead,
    onClose,
    onEdit,
    onRefresh,
    userRole,
    userPermissions = [],
}: LeadDetailsModalProps) {
    const router = useRouter();
    const [converting, setConverting] = useState(false);
    const [loggingCall, setLoggingCall] = useState(false);
    const [followUpDraft, setFollowUpDraft] = useState("");

    const canEditLead = canEdit(userRole || "", userPermissions, "leads");
    const canDeal = canCreate(userRole || "", userPermissions, "deals");
    const customerName = lead.customer?.name?.trim() || null;
    const title = customerName ?? "Lead";
    const email = lead.customer?.email?.trim() || null;
    const phone = lead.customer?.phone?.trim() || null;

    const vehicleLabel = lead.vehicle
        ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
        : parseVehicleFromNotes(lead.notes);

    const scored = resolveLeadScore(lead);

    const activityItems = [
        {
            id: "created",
            title: "Lead created",
            timestamp: formatDateTime(lead.lead_creation_date),
        },
        {
            id: "engagement",
            title: "Last engagement",
            timestamp: formatDateTime(lead.last_engagement),
        },
    ];

    async function logCall() {
        setLoggingCall(true);
        try {
            await apiFetch(`/api/leads/${lead.id}/log-call`, {
                method: "POST",
                body: {
                    outcome: "Connected",
                    note: "Call logged from lead drawer",
                },
            });
            toast.success("Call logged — score updated");
            onRefresh?.();
            if (phone) window.location.href = `tel:${phone}`;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to log call");
        } finally {
            setLoggingCall(false);
        }
    }

    const convertToDeal = async () => {
        if (lead.converted_deal_id) {
            router.push(`/deals/${lead.converted_deal_id}`);
            return;
        }
        setConverting(true);
        try {
            const res = await apiFetch<{
                data?: { deal?: { id: string } };
                redirect?: string;
            }>(`/api/leads/${lead.id}/convert`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            toast.success("Lead converted to deal");
            onClose();
            router.push(res.redirect || `/deals/${res.data?.deal?.id}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Convert failed";
            const data =
                err instanceof ApiError
                    ? (err.data as { redirect?: string; code?: string } | null)
                    : undefined;
            if (data?.redirect) {
                toast.error(message);
                router.push(data.redirect);
                onClose();
                return;
            }
            if (
                message.toLowerCase().includes("vehicle") ||
                message.toLowerCase().includes("price")
            ) {
                toast.error(message);
                router.push(
                    `/deals/new?lead_id=${lead.id}&customer_id=${lead.customer_id || ""}${
                        lead.interest_vehicle_id
                            ? `&vehicle_id=${lead.interest_vehicle_id}`
                            : ""
                    }`
                );
                onClose();
                return;
            }
            toast.error(message);
        } finally {
            setConverting(false);
        }
    };

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={title}
                    avatarSrc={lead.customer?.avatar}
                    avatarName={customerName}
                    badges={
                        <>
                            <StatusBadge status={lead.status} resource="lead" />
                            <span
                                className={cn(
                                    "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                                    temperatureClass(scored.temperature)
                                )}
                            >
                                {scored.temperature} · {scored.score}
                            </span>
                            {lead.source && (
                                <Badge variant="subtle" className="text-[11px]">
                                    {lead.source}
                                </Badge>
                            )}
                        </>
                    }
                />
            }
            actions={
                <>
                    {canDeal && (
                        <Button
                            variant="primary"
                            size="sm"
                            leftIcon={
                                converting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <FileText className="h-3.5 w-3.5" />
                                )
                            }
                            disabled={converting}
                            onClick={() => void convertToDeal()}
                        >
                            {lead.converted_deal_id ? "Open deal" : "Convert to deal"}
                        </Button>
                    )}
                    {canEditLead && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Edit className="h-3.5 w-3.5" />}
                            onClick={onEdit}
                        >
                            Edit
                        </Button>
                    )}
                    {canEditLead && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={
                                loggingCall ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <PhoneCall className="h-3.5 w-3.5" />
                                )
                            }
                            disabled={loggingCall}
                            onClick={() => void logCall()}
                        >
                            Log call
                        </Button>
                    )}
                    {phone && (
                        <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Phone className="h-3.5 w-3.5" />}
                            onClick={() => {
                                window.location.href = `tel:${phone}`;
                            }}
                        >
                            Dial
                        </Button>
                    )}
                    {email && (
                        <Button
                            variant="ghost"
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
                <PropertyList title="Details">
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
                    <PropertyRow label="Interest vehicle">
                        {vehicleLabel || <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Assigned">
                        {lead.assigned_user ? (
                            <span className="text-sm">{lead.assigned_user.full_name}</span>
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Score">
                        {scored.temperature} ({scored.score})
                    </PropertyRow>
                </PropertyList>

                <LeadScoreExplanation
                    leadId={lead.id}
                    input={{
                        source: lead.source,
                        status: lead.status,
                        last_engagement: lead.last_engagement,
                        lead_creation_date: lead.lead_creation_date,
                        created_at: lead.created_at,
                        interest_vehicle_id: lead.interest_vehicle_id,
                        notes: lead.notes,
                    }}
                    persistedExplanation={lead.ai_why}
                />

                <RecordNotes>{lead.notes}</RecordNotes>
                <ActivityTimeline items={activityItems} title="Activity" />
                <div className="space-y-2 rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Flash AI follow-up draft
                    </p>
                    <AiActionButton
                        label="Draft email follow-up"
                        endpoint="/api/ai/follow-up"
                        body={{ lead_id: lead.id, channel: "email" }}
                        onResult={(content, raw) => {
                            const data = raw as {
                                subject?: string | null;
                                body?: string;
                                casl_note?: string;
                                sent?: boolean;
                            };
                            setFollowUpDraft(
                                [
                                    data.subject ? `Subject: ${data.subject}` : null,
                                    data.body || content,
                                    "",
                                    data.casl_note ||
                                        "Draft only — not sent. Review CASL before send.",
                                ]
                                    .filter(Boolean)
                                    .join("\n")
                            );
                        }}
                    />
                    {followUpDraft ? (
                        <textarea
                            readOnly
                            rows={8}
                            value={followUpDraft}
                            className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                        />
                    ) : null}
                </div>
                <LeadEmailSequencePanel
                    leadId={lead.id}
                    customerEmail={email}
                    canEdit={canEditLead}
                />

                <AfterHoursPanel leadId={lead.id} canEdit={canEditLead} />
            </div>
        </RecordDrawer>
    );
}
