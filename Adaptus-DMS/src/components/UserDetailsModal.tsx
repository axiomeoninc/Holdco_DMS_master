"use client";

import { Edit, Mail, Phone } from "lucide-react";
import { RecordDrawer } from "@/src/components/ui/RecordDrawer";
import { RecordHeader } from "@/src/components/ui/RecordHeader";
import {
    PropertyList,
    PropertyRow,
    PropertyEmpty,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";

interface User {
    id: string;
    avatar: string | null;
    full_name: string;
    role: string;
    email: string;
    phone: string | null;
    start_date: string;
    created_at: string;
    updated_at: string;
}

interface UserDetailsModalProps {
    user: User;
    onClose: () => void;
    onEdit: () => void;
    userRole?: string;
    userPermissions?: string[];
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export default function UserDetailsModal({
    user,
    onClose,
    onEdit,
    userRole,
    userPermissions = [],
}: UserDetailsModalProps) {
    const canEdit = userRole === "Admin" || userPermissions.includes("users:write");
    const name = user.full_name?.trim() || null;
    const email = user.email?.trim() || null;
    const phone = user.phone?.trim() || null;

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={name ?? "User"}
                    avatarSrc={user.avatar}
                    avatarName={name}
                    badges={
                        user.role ? (
                            <Badge variant="subtle" className="text-[11px]">
                                {user.role}
                            </Badge>
                        ) : undefined
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
                    <PropertyRow label="Role">{user.role || <PropertyEmpty />}</PropertyRow>
                    <PropertyRow label="Start date">
                        {user.start_date ? formatDate(user.start_date) : <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                <ActivityTimeline
                    items={[
                        { id: "created", title: "Created", timestamp: formatDate(user.created_at) },
                        { id: "updated", title: "Last updated", timestamp: formatDate(user.updated_at) },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
