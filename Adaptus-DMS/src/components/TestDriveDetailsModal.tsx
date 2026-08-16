"use client";

import { Edit, Mail, Phone, ExternalLink } from "lucide-react";
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
import { RelationChip } from "@/src/components/ui/RelationChip";

interface TestDrive {
    id: string;
    customer_id: string | null;
    lead_id: string | null;
    vehicle_id: string;
    driver_license_number: string;
    driver_license_expiry: string;
    driver_license_image_url: string | null;
    signature_image_url: string | null;
    start_time: string | null;
    scheduled_date?: string | null;
    end_time: string | null;
    salesperson_id: string | null;
    notes: string | null;
    status: string;
    outcome?: string | null;
    created_at: string;
    updated_at: string;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar: string | null;
    } | null;
    lead: {
        id: string;
        source: string;
        status: string;
        customer: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        } | null;
    } | null;
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
        vin: string;
        stock_number: string | null;
    } | null;
    salesperson: {
        id: string;
        full_name: string;
        email: string;
        avatar: string | null;
    } | null;
}

interface TestDriveDetailsModalProps {
    testDrive: TestDrive;
    onClose: () => void;
    onEdit: () => void;
    userRole?: string;
    userPermissions?: string[];
}

function formatDateTime(date: string | null | undefined) {
    if (!date) return null;
    return new Date(date).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function TestDriveDetailsModal({
    testDrive,
    onClose,
    onEdit,
    userRole,
    userPermissions = [],
}: TestDriveDetailsModalProps) {
    const canEdit = userRole === "Admin" || userPermissions.includes("test_drives:write");
    const customer =
        testDrive.customer ??
        (testDrive.lead?.customer
            ? {
                  id: testDrive.lead.customer.id,
                  name: testDrive.lead.customer.name,
                  email: testDrive.lead.customer.email,
                  phone: testDrive.lead.customer.phone,
                  avatar: null as string | null,
              }
            : null);
    const customerName = customer?.name?.trim() || null;
    const email = customer?.email?.trim() || null;
    const phone = customer?.phone?.trim() || null;
    const vehicleTitle = testDrive.vehicle
        ? `${testDrive.vehicle.year} ${testDrive.vehicle.make} ${testDrive.vehicle.model}`
        : "Test drive";

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={customerName ?? vehicleTitle}
                    avatarSrc={customer?.avatar}
                    avatarName={customerName}
                    subtitle={testDrive.vehicle ? vehicleTitle : undefined}
                    badges={<StatusBadge status={testDrive.status} resource="test_drive" />}
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
                <PropertyList title="Details">
                    <PropertyRow label="Customer">
                        <RelationChip
                            customerId={testDrive.customer_id || customer?.id}
                            name={customerName}
                            avatarUrl={customer?.avatar}
                            emptyLabel="Unlinked"
                            className="justify-end"
                        />
                    </PropertyRow>
                    <PropertyRow label="Vehicle">
                        {testDrive.vehicle ? vehicleTitle : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="VIN">
                        {testDrive.vehicle?.vin ? (
                            <span className="font-mono text-[12px]">{testDrive.vehicle.vin}</span>
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Salesperson">
                        {testDrive.salesperson?.full_name?.trim() ? (
                            testDrive.salesperson.full_name
                        ) : (
                            <PropertyEmpty label="Unassigned" />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Scheduled">
                        {formatDateTime(testDrive.scheduled_date || testDrive.start_time) ?? (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    <PropertyRow label="Ended">
                        {formatDateTime(testDrive.end_time) ?? <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="License #">
                        {testDrive.driver_license_number?.trim() ? (
                            testDrive.driver_license_number
                        ) : (
                            <PropertyEmpty />
                        )}
                    </PropertyRow>
                    <PropertyRow label="License expiry">
                        {testDrive.driver_license_expiry
                            ? formatDateTime(testDrive.driver_license_expiry) ?? testDrive.driver_license_expiry
                            : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Outcome">
                        {testDrive.outcome?.trim() ? testDrive.outcome : <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                {(testDrive.driver_license_image_url || testDrive.signature_image_url) && (
                    <PropertyList title="Documents">
                        {testDrive.driver_license_image_url && (
                            <PropertyRow label="License image">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    onClick={() =>
                                        window.open(
                                            testDrive.driver_license_image_url!,
                                            "_blank",
                                            "noopener,noreferrer"
                                        )
                                    }
                                >
                                    View <ExternalLink className="h-3 w-3" />
                                </button>
                            </PropertyRow>
                        )}
                        {testDrive.signature_image_url && (
                            <PropertyRow label="Signature">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    onClick={() =>
                                        window.open(
                                            testDrive.signature_image_url!,
                                            "_blank",
                                            "noopener,noreferrer"
                                        )
                                    }
                                >
                                    View <ExternalLink className="h-3 w-3" />
                                </button>
                            </PropertyRow>
                        )}
                    </PropertyList>
                )}

                {testDrive.notes?.trim() && <RecordNotes>{testDrive.notes}</RecordNotes>}

                <ActivityTimeline
                    items={[
                        {
                            id: "created",
                            title: "Created",
                            timestamp: formatDateTime(testDrive.created_at) ?? undefined,
                        },
                        {
                            id: "updated",
                            title: "Updated",
                            timestamp: formatDateTime(testDrive.updated_at) ?? undefined,
                        },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
