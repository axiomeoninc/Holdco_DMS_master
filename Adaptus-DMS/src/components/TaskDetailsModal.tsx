"use client";

import { useState } from "react";
import { Edit, Trash2, Send, Loader2, AlertTriangle } from "lucide-react";
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
import { ActivityTimeline, type ActivityItem } from "@/src/components/ui/ActivityTimeline";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { cn } from "@/src/lib/utils";

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface TaskNote {
    id: string;
    content: string;
    created_at: string;
    user?: UserData | null;
}

interface TaskActivity {
    id: string;
    action: string;
    created_at: string;
    new_value?: string | Record<string, unknown> | null;
    user?: UserData | null;
}

interface TaskLink {
    link_type: string;
    linked_id: string;
}

interface Task {
    id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    created_by: string | null;
    due_date: string | null;
    reminder_at: string | null;
    priority: string;
    status: string;
    notes: string | null;
    tags: string[] | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    source_type: string | null;
    source_id: string | null;
    assigned_user: UserData | null;
    created_by_user: UserData | null;
    task_notes?: TaskNote[];
    task_attachments?: unknown[];
    task_reminders?: unknown[];
    task_links?: TaskLink[];
    task_activity?: TaskActivity[];
}

interface TaskDetailsModalProps {
    task: Task;
    users?: UserData[];
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (task: Task, newStatus: string) => void;
    onRefresh: () => void;
    userRole?: string;
    userPermissions?: string[];
}

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Cancelled", "On Hold"];

function formatDate(date: string | null) {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatDateTime(date: string | null) {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function TaskDetailsModal({
    task,
    onClose,
    onEdit,
    onDelete,
    onStatusChange,
    onRefresh,
    userRole,
    userPermissions = [],
}: TaskDetailsModalProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [addingNote, setAddingNote] = useState(false);
    const [activeTab, setActiveTab] = useState<"details" | "notes" | "activity">("details");

    const canEdit = userRole === "Admin" || userPermissions.includes("tasks:write");
    const canDelete = userRole === "Admin" || userPermissions.includes("tasks:delete");
    const isOverdue =
        !!task.due_date &&
        task.status !== "Completed" &&
        task.status !== "Cancelled" &&
        new Date(task.due_date) < new Date();

    async function handleDelete() {
        setDeleting(true);
        try {
            const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete task");
            setShowDeleteConfirm(false);
            onDelete();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setDeleting(false);
        }
    }

    async function handleAddNote() {
        if (!newNote.trim()) return;
        setAddingNote(true);
        try {
            const response = await fetch(`/api/tasks/${task.id}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newNote.trim() }),
            });
            if (!response.ok) throw new Error("Failed to add note");
            setNewNote("");
            onRefresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setAddingNote(false);
        }
    }

    const activityItems: ActivityItem[] = (task.task_activity ?? []).map((a) => ({
        id: a.id,
        title: a.user?.full_name?.trim() || "System",
        description: (
            <>
                <span>{a.action}</span>
                {a.new_value != null && (
                    <span className="mt-1 block text-[12px]">
                        {typeof a.new_value === "string" ? a.new_value : JSON.stringify(a.new_value)}
                    </span>
                )}
            </>
        ),
        timestamp: formatDateTime(a.created_at),
    }));

    const tabs: Array<{ id: "details" | "notes" | "activity"; label: string }> = [
        { id: "details", label: "Details" },
        {
            id: "notes",
            label: `Notes${task.task_notes?.length ? ` (${task.task_notes.length})` : ""}`,
        },
        { id: "activity", label: "Activity" },
    ];

    return (
        <>
            <RecordDrawer
                open
                onClose={onClose}
                header={
                    <RecordHeader
                        title={task.title}
                        showAvatar={false}
                        badges={
                            <>
                                <StatusBadge status={task.status} resource="task" />
                                {task.priority && (
                                    <Badge variant="subtle" className="text-[11px]">
                                        {task.priority}
                                    </Badge>
                                )}
                                {isOverdue && (
                                    <Badge variant="destructive" className="text-[11px]">
                                        <AlertTriangle className="mr-1 h-3 w-3" />
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
                <div className="mb-4 flex gap-2 border-b border-border">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                                activeTab === tab.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === "details" && (
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
                                        variant={task.status === status ? "primary" : "outline"}
                                        disabled={task.status === status}
                                        onClick={() => onStatusChange(task, status)}
                                    >
                                        {status}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {task.description?.trim() && (
                            <RecordNotes title="Description">{task.description}</RecordNotes>
                        )}

                        <PropertyList title="Details">
                            <PropertyRow label="Due">
                                {formatDate(task.due_date) ? (
                                    <span className={isOverdue ? "text-destructive" : undefined}>
                                        {formatDate(task.due_date)}
                                    </span>
                                ) : (
                                    <PropertyEmpty label="Not set" />
                                )}
                            </PropertyRow>
                            <PropertyRow label="Assigned to">
                                {task.assigned_user?.full_name?.trim() ? (
                                    task.assigned_user.full_name
                                ) : (
                                    <PropertyEmpty label="Unassigned" />
                                )}
                            </PropertyRow>
                            <PropertyRow label="Created by">
                                {task.created_by_user?.full_name?.trim() ? (
                                    task.created_by_user.full_name
                                ) : (
                                    <PropertyEmpty />
                                )}
                            </PropertyRow>
                            <PropertyRow label="Created">
                                {formatDate(task.created_at) ?? <PropertyEmpty />}
                            </PropertyRow>
                        </PropertyList>

                        {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {task.tags.map((tag) => (
                                    <Badge key={tag} variant="subtle">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {task.notes?.trim() && <RecordNotes title="Internal notes">{task.notes}</RecordNotes>}

                        {task.task_links && task.task_links.length > 0 && (
                            <PropertyList title="Related">
                                {task.task_links.map((link, i) => (
                                    <PropertyRow key={i} label={link.link_type}>
                                        <span className="font-mono text-[12px]">
                                            {link.linked_id.slice(0, 8)}…
                                        </span>
                                    </PropertyRow>
                                ))}
                            </PropertyList>
                        )}
                    </div>
                )}

                {activeTab === "notes" && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Write a note…"
                                rows={2}
                                className="min-h-[72px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleAddNote}
                                disabled={addingNote || !newNote.trim()}
                                leftIcon={
                                    addingNote ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Send className="h-3.5 w-3.5" />
                                    )
                                }
                            >
                                Post
                            </Button>
                        </div>
                        {(!task.task_notes || task.task_notes.length === 0) ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No notes yet</p>
                        ) : (
                            <div className="space-y-4">
                                {task.task_notes.map((note) => (
                                    <div key={note.id} className="border-b border-border/70 pb-3 last:border-0">
                                        <div className="mb-1 flex items-baseline justify-between gap-2">
                                            <span className="text-[13px] font-medium">
                                                {note.user?.full_name?.trim() || "—"}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                                {formatDateTime(note.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap text-foreground">{note.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "activity" && (
                    <ActivityTimeline
                        items={activityItems}
                        emptyLabel="No activity yet"
                    />
                )}
            </RecordDrawer>

            {showDeleteConfirm && (
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Task"
                    message={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
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
