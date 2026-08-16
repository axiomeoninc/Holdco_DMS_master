"use client";

import { Edit, Mail, Phone } from "lucide-react";
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
import { Badge } from "@/src/components/ui/Badge";

interface Vendor {
    id: string;
    vendor_type: string;
    vendor_name: string;
    address: string | null;
    phone: string | null;
    gst_number: string | null;
    hst_number: string | null;
    pst_number: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    created_at: string;
}

interface VendorDetailsModalProps {
    vendor: Vendor;
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

export default function VendorDetailsModal({
    vendor,
    onClose,
    onEdit,
    userRole,
    userPermissions = [],
}: VendorDetailsModalProps) {
    const canEdit = userRole === "Admin" || userPermissions.includes("vendors:write");
    const name = vendor.vendor_name?.trim() || null;
    const email = vendor.contact_email?.trim() || null;
    const phone = (vendor.contact_phone || vendor.phone)?.trim() || null;
    const region = [vendor.city, vendor.province, vendor.postal_code].filter(Boolean).join(", ");

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={name ?? "Vendor"}
                    showAvatar={false}
                    badges={
                        vendor.vendor_type ? (
                            <Badge variant="subtle" className="text-[11px]">
                                {vendor.vendor_type}
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
                <PropertyList title="Contact">
                    <PropertyRow label="Contact name">
                        {vendor.contact_name?.trim() ? vendor.contact_name : <PropertyEmpty />}
                    </PropertyRow>
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
                    <PropertyRow label="Address">
                        {vendor.address?.trim() ? vendor.address : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="City / region">{region || <PropertyEmpty />}</PropertyRow>
                </PropertyList>

                <PropertyList title="Tax IDs">
                    <PropertyRow label="GST">
                        {vendor.gst_number?.trim() ? vendor.gst_number : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="HST">
                        {vendor.hst_number?.trim() ? vendor.hst_number : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="PST">
                        {vendor.pst_number?.trim() ? vendor.pst_number : <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                {vendor.notes?.trim() && <RecordNotes>{vendor.notes}</RecordNotes>}

                <ActivityTimeline
                    items={[
                        {
                            id: "created",
                            title: "Vendor created",
                            timestamp: formatDate(vendor.created_at),
                        },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
