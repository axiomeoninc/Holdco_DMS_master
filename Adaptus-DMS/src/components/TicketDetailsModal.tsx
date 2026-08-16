"use client";

import { useState } from "react";
import { Edit, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { toast } from "@/src/lib/toast";
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

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Ticket {
    id: string;
    subject: string;
    description: string | null;
    assigned_to: string | null;
    created_by: string | null;
    priority: string;
    status: string;
    resolved_at: string | null;
    created_at: string;
    assigned_user: UserData | null;
    created_by_user: UserData | null;
}

interface TicketDetailsModalProps {
    ticket: Ticket;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (ticket: Ticket, newStatus: string) => void;
    userRole?: string;
    userPermissions?: string[];
}

const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];

function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function TicketDetailsModal({
    ticket,
    onClose,
    onEdit,
    onDelete,
    onStatusChange,
    userRole,
    userPermissions = [],
}: TicketDetailsModalProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const canEdit = userRole === "Admin" || userPermissions.includes("tickets:write");
    const canDelete = userRole === "Admin" || userPermissions.includes("tickets:delete");

    async function handleDelete() {
        setDeleting(true);
        try {
            const response = await fetch(`/api/tickets/${ticket.id}`, {
                method: "DELETE",
            });
            if (!response.ok) throw new Error("Failed to delete ticket");
            setShowDeleteConfirm(false);
            onDelete();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            <RecordDrawer
                open
                onClose={onClose}
                header={
                    <RecordHeader
                        title={ticket.subject}
                        showAvatar={false}
                        badges={
                            <>
                                <StatusBadge status={ticket.status} resource="ticket" />
                                {ticket.priority && (
                                    <Badge variant="subtle" className="text-[11px]">
                                        {ticket.priority}
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
                        {canDelete && (
                            <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                                onClick={() => setShowDeleteConfirm(true)}
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
                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Status
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((status) => (
                                <Button
                                    key={status}
                                    size="sm"
                                    variant={ticket.status === status ? "primary" : "outline"}
                                    disabled={ticket.status === status}
                                    onClick={() => onStatusChange(ticket, status)}
                                >
                                    {status}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {ticket.description?.trim() && (
                        <RecordNotes title="Description">{ticket.description}</RecordNotes>
                    )}

                    <PropertyList title="Details">
                        <PropertyRow label="Assigned to">
                            {ticket.assigned_user?.full_name?.trim() ? (
                                ticket.assigned_user.full_name
                            ) : (
                                <PropertyEmpty label="Unassigned" />
                            )}
                        </PropertyRow>
                        <PropertyRow label="Created by">
                            {ticket.created_by_user?.full_name?.trim() ? (
                                ticket.created_by_user.full_name
                            ) : (
                                <PropertyEmpty />
                            )}
                        </PropertyRow>
                        <PropertyRow label="Priority">{ticket.priority || <PropertyEmpty />}</PropertyRow>
                    </PropertyList>

                    <ActivityTimeline
                        items={[
                            {
                                id: "created",
                                title: "Created",
                                timestamp: formatDate(ticket.created_at),
                            },
                            ...(ticket.resolved_at
                                ? [
                                      {
                                          id: "resolved",
                                          title: "Resolved",
                                          timestamp: formatDate(ticket.resolved_at),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </div>
            </RecordDrawer>

            {showDeleteConfirm && (
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Ticket"
                    message={`Are you sure you want to delete "${ticket.subject}"? This action cannot be undone.`}
                    confirmText={deleting ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={deleting}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
}
