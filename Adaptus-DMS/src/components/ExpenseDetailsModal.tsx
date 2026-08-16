"use client";

import { Edit, Trash2 } from "lucide-react";
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

interface Vendor {
    id: string;
    vendor_name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
}

interface Vehicle {
    id: string;
    make: string;
    model: string;
    year: number;
    vin: string;
}

interface UserData {
    id: string;
    full_name: string;
}

interface Expense {
    id: string;
    description: string | null;
    amount: number;
    category: string;
    vendor_id: string | null;
    vehicle_id: string | null;
    expense_date: string;
    due_date: string | null;
    status: string;
    reference_number: string | null;
    notes: string | null;
    tax_amount: number;
    payment_method: string | null;
    created_at: string;
    vendor: Vendor | null;
    vehicle: Vehicle | null;
    entered_by_user: UserData | null;
}

interface ExpenseDetailsModalProps {
    expense: Expense;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
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

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(amount || 0);
}

export default function ExpenseDetailsModal({
    expense,
    onClose,
    onEdit,
    onDelete,
    userRole,
    userPermissions = [],
}: ExpenseDetailsModalProps) {
    const canEdit = userRole === "Admin" || userPermissions.includes("expenses:write");
    const canDelete = userRole === "Admin" || userPermissions.includes("expenses:delete");
    const title =
        expense.description?.trim() ||
        expense.reference_number?.trim() ||
        "Expense";
    const isOverdue =
        expense.status === "Pending" &&
        !!expense.due_date &&
        new Date(expense.due_date) < new Date();

    return (
        <RecordDrawer
            open
            onClose={onClose}
            header={
                <RecordHeader
                    title={title}
                    showAvatar={false}
                    subtitle={
                        <span className="tabular-nums font-medium text-foreground">
                            {formatCurrency(expense.amount)}
                        </span>
                    }
                    badges={
                        <>
                            <StatusBadge status={expense.status} resource="expense" />
                            {expense.category && (
                                <Badge variant="subtle" className="text-[11px]">
                                    {expense.category}
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
                <PropertyList title="Details">
                    <PropertyRow label="Amount">{formatCurrency(expense.amount)}</PropertyRow>
                    <PropertyRow label="Tax">{formatCurrency(expense.tax_amount)}</PropertyRow>
                    <PropertyRow label="Date">{formatDate(expense.expense_date)}</PropertyRow>
                    <PropertyRow label="Due">
                        {expense.due_date ? formatDate(expense.due_date) : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Vendor">
                        {expense.vendor?.vendor_name?.trim() ? expense.vendor.vendor_name : <PropertyEmpty label="—" />}
                    </PropertyRow>
                    <PropertyRow label="Vehicle">
                        {expense.vehicle
                            ? `${expense.vehicle.year} ${expense.vehicle.make} ${expense.vehicle.model}`
                            : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Payment method">
                        {expense.payment_method?.trim() ? expense.payment_method : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Reference">
                        {expense.reference_number?.trim() ? expense.reference_number : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Entered by">
                        {expense.entered_by_user?.full_name?.trim()
                            ? expense.entered_by_user.full_name
                            : <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                {expense.notes?.trim() && <RecordNotes>{expense.notes}</RecordNotes>}

                <ActivityTimeline
                    items={[
                        {
                            id: "created",
                            title: "Expense recorded",
                            timestamp: formatDate(expense.created_at),
                        },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
