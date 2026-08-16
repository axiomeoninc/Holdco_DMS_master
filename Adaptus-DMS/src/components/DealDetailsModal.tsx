"use client";

import { Edit, FileSignature, Loader2, Car } from "lucide-react";
import { firstImageUrl } from "@/src/lib/vehicle-image";
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

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    retail_price: number;
    status: string;
    condition: string;
    image_gallery?: string[];
}

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
}

interface Salesperson {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Deal {
    id: string;
    vehicle_id: string | null;
    customer_id: string | null;
    deal_status: string;
    finance_term: number | null;
    interest_rate: number | null;
    down_payment: number;
    sale_price: number;
    salesperson_id: string | null;
    finance_company: string | null;
    notes: string | null;
    deal_date: string;
    created_at: string;
    vehicle: Vehicle | null;
    customer: Customer | null;
    salesperson: Salesperson | null;
}

interface DealDetailsModalProps {
    deal: Deal;
    onClose: () => void;
    onEdit: () => void;
    onBillOfSale?: () => void;
    billOfSaleLoading?: boolean;
    userRole?: string;
    userPermissions?: string[];
}

function estimateMonthlyPayment(
    salePrice: number,
    downPayment: number,
    termMonths: number | null,
    interestRate: number | null
): number | null {
    if (!termMonths || termMonths <= 0) return null;
    const principal = Math.max(0, salePrice - (downPayment || 0));
    if (principal <= 0) return 0;
    const rate = (interestRate || 0) / 100 / 12;
    if (rate <= 0) return principal / termMonths;
    const factor = Math.pow(1 + rate, termMonths);
    return (principal * rate * factor) / (factor - 1);
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

export default function DealDetailsModal({
    deal,
    onClose,
    onEdit,
    onBillOfSale,
    billOfSaleLoading = false,
    userRole,
    userPermissions = [],
}: DealDetailsModalProps) {
    const canEdit = userRole === "Admin" || userPermissions.includes("deals:write");
    const monthlyPayment = estimateMonthlyPayment(
        deal.sale_price,
        deal.down_payment,
        deal.finance_term,
        deal.interest_rate
    );
    const amountFinanced = Math.max(0, (deal.sale_price || 0) - (deal.down_payment || 0));
    const vehicleTitle = deal.vehicle
        ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
        : "Deal";
    const thumb = deal.vehicle ? firstImageUrl(deal.vehicle.image_gallery) : null;

    return (
        <RecordDrawer
            open
            onClose={onClose}
            size="lg"
            header={
                <RecordHeader
                    title={vehicleTitle}
                    showAvatar={false}
                    subtitle={formatDate(deal.deal_date)}
                    badges={<StatusBadge status={deal.deal_status} resource="deal" />}
                />
            }
            actions={
                <>
                    {canEdit && (
                        <Button variant="primary" size="sm" leftIcon={<Edit className="h-3.5 w-3.5" />} onClick={onEdit}>
                            Edit
                        </Button>
                    )}
                    {onBillOfSale && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={
                                billOfSaleLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <FileSignature className="h-3.5 w-3.5" />
                                )
                            }
                            onClick={onBillOfSale}
                            disabled={billOfSaleLoading}
                        >
                            Bill of Sale
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
                {deal.vehicle && (
                    <div className="flex items-center gap-3">
                        {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={thumb}
                                alt={vehicleTitle}
                                className="h-16 w-16 rounded-lg object-cover"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                                <Car className="h-6 w-6 text-muted-foreground" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{vehicleTitle}</p>
                            <p className="truncate font-mono text-[12px] text-muted-foreground">
                                {deal.vehicle.vin}
                            </p>
                        </div>
                    </div>
                )}

                <PropertyList title="Parties">
                    <PropertyRow label="Customer">
                        <RelationChip
                            customerId={deal.customer_id || deal.customer?.id}
                            name={deal.customer?.name}
                            avatarUrl={deal.customer?.avatar}
                            emptyLabel="Cash"
                            className="justify-end"
                        />
                    </PropertyRow>
                    <PropertyRow label="Salesperson">
                        {deal.salesperson?.full_name?.trim() ? (
                            deal.salesperson.full_name
                        ) : (
                            <PropertyEmpty label="Unassigned" />
                        )}
                    </PropertyRow>
                </PropertyList>

                <PropertyList title="Finance">
                    <PropertyRow label="Sale price">{formatCurrency(deal.sale_price)}</PropertyRow>
                    <PropertyRow label="Down payment">{formatCurrency(deal.down_payment)}</PropertyRow>
                    <PropertyRow label="Amount financed">{formatCurrency(amountFinanced)}</PropertyRow>
                    <PropertyRow label="Est. monthly">
                        {monthlyPayment != null ? formatCurrency(monthlyPayment) : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Term">
                        {deal.finance_term != null ? `${deal.finance_term} months` : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Rate">
                        {deal.interest_rate != null ? `${deal.interest_rate}%` : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Finance company">
                        {deal.finance_company?.trim() ? deal.finance_company : <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                {deal.notes?.trim() && <RecordNotes>{deal.notes}</RecordNotes>}

                <ActivityTimeline
                    items={[
                        { id: "deal", title: "Deal date", timestamp: formatDate(deal.deal_date) },
                        { id: "created", title: "Created", timestamp: formatDate(deal.created_at) },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
