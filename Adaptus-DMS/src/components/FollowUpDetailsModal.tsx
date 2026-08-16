"use client";

import { Edit, Trash2, Mail, Phone } from "lucide-react";
import { RecordDrawer } from "@/src/components/ui/RecordDrawer";
import { RecordHeader } from "@/src/components/ui/RecordHeader";
import {
    PropertyList,
    PropertyRow,
    PropertyEmpty,
    RecordNotes,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline, type ActivityItem } from "@/src/components/ui/ActivityTimeline";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { RelationChip } from "@/src/components/ui/RelationChip";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
}

interface Lead {
    id: string;
    source: string;
    status: string;
}

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface FollowUpHistory {
    id: string;
    follow_up_id: string;
    edited_by: string;
    action: string;
    previous_description: string | null;
    new_description: string | null;
    previous_status: string | null;
    new_status: string | null;
    created_at: string;
    edited_by_user: UserData | null;
}

interface FollowUp {
    id: string;
    title: string;
    description: string | null;
    customer_id: string | null;
    lead_id: string | null;
    assigned_to: string | null;
    follow_up_date: string;
    follow_up_time: string | null;
    priority: string;
    status: string;
    notes: string | null;
    completed_at: string | null;
    created_at: string;
    customer: Customer | null;
    lead: Lead | null;
    assigned_user: UserData | null;
    history?: FollowUpHistory[];
}

interface FollowUpDetailsModalProps {
    followUp: FollowUp;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    userRole?: string;
    userPermissions?: string[];
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatDateTime(date: string) {
    return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function FollowUpDetailsModal({
    followUp,
    onClose,
    onEdit,
    onDelete,
    userRole,
    userPermissions = [],
}: FollowUpDetailsModalProps) {
    const canEdit = userRole === "Admin" || userPermissions.includes("follow_ups:write");
    const canDelete = userRole === "Admin" || userPermissions.includes("follow_ups:delete");
    const isOverdue =
        followUp.status === "Pending" && new Date(followUp.follow_up_date) < new Date();
    const email = followUp.customer?.email?.trim() || null;
    const phone = followUp.customer?.phone?.trim() || null;

    const historyItems: ActivityItem[] = (followUp.history ?? []).map((h) => ({
        id: h.id,
        title: h.edited_by_user?.full_name?.trim() || h.action,
        description: h.new_status
            ? `${h.previous_status ?? "—"} → ${h.new_status}`
            : h.new_description ?? h.action,
        timestamp: formatDateTime(h.created_at),
    }));

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={followUp.title}
                    showAvatar={false}
                    subtitle={`${formatDate(followUp.follow_up_date)}${
                        followUp.follow_up_time ? ` · ${followUp.follow_up_time}` : ""
                    }`}
                    badges={
                        <>
                            <StatusBadge status={followUp.status} resource="follow_up" />
                            {followUp.priority && (
                                <Badge variant="subtle" className="text-[11px]">
                                    {followUp.priority}
                                </Badge>
                            )}
                            {isOverdue && (
                                <Badge variant="destructive" className="text-[11px]">
                                    Overdue
                                </Badge>
                            )}
                        </>
                    }
                />
            }
            actions={
                <>
                    {canEdit && (
                        <Button variant="primary" size="sm" leftIcon={<Edit className="h-3.5 w-3.5" />} onClick={onEdit}>
                            Edit
                        </Button>
                    )}
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
                    {canDelete && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={onDelete}
                            className="text-destructive"
                        >
                            Delete
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
                {followUp.description?.trim() && (
                    <RecordNotes title="Description">{followUp.description}</RecordNotes>
                )}

                <PropertyList title="Details">
                    <PropertyRow label="Customer">
                        <RelationChip
                            customerId={followUp.customer_id || followUp.customer?.id}
                            name={followUp.customer?.name}
                            avatarUrl={followUp.customer?.avatar}
                            emptyLabel="Unlinked"
                            className="justify-end"
                        />
                    </PropertyRow>
                    <PropertyRow label="Assigned to">
                        {followUp.assigned_user?.full_name?.trim() ? (
                            followUp.assigned_user.full_name
                        ) : (
                            <PropertyEmpty label="Unassigned" />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Lead">
                        {followUp.lead ? (
                            `${followUp.lead.source} · ${followUp.lead.status}`
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                </PropertyList>

                {followUp.notes?.trim() && <RecordNotes>{followUp.notes}</RecordNotes>}

                <ActivityTimeline
                    title="History"
                    items={
                        historyItems.length > 0
                            ? historyItems
                            : [
                                  {
                                      id: "created",
                                      title: "Created",
                                      timestamp: formatDateTime(followUp.created_at),
                                  },
                                  ...(followUp.completed_at
                                      ? [
                                            {
                                                id: "completed",
                                                title: "Completed",
                                                timestamp: formatDateTime(followUp.completed_at),
                                            },
                                        ]
                                      : []),
                              ]
                    }
                />
            </div>
        </RecordDrawer>
    );
}
