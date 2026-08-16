"use client";

import { useState } from "react";
import { Edit, ChevronLeft, ChevronRight, Image as ImageIcon, ExternalLink } from "lucide-react";
import { parseGallery } from "@/src/lib/vehicle-image";
import { RecordDrawer } from "@/src/components/ui/RecordDrawer";
import { RecordHeader } from "@/src/components/ui/RecordHeader";
import {
    PropertyList,
    PropertyRow,
    PropertyEmpty,
} from "@/src/components/ui/PropertyList";
import { ActivityTimeline } from "@/src/components/ui/ActivityTimeline";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    odometer: number;
    stock_number: string | null;
    condition: string;
    status: string;
    purchase_price: number;
    retail_price: number;
    extra_costs: number;
    taxes: number;
    image_gallery: string[];
    carfax_report_url?: string;
    created_at: string;
    updated_at: string;
}

interface VehicleDetailsModalProps {
    vehicle: Vehicle;
    onClose: () => void;
    onEdit: () => void;
    userRole?: string;
    userPermissions?: string[];
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export default function VehicleDetailsModal({
    vehicle,
    onClose,
    onEdit,
    userRole,
    userPermissions = [],
}: VehicleDetailsModalProps) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const canEdit = userRole === "Admin" || userPermissions.includes("vehicles:write");
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const grossProfit =
        vehicle.retail_price - vehicle.purchase_price - vehicle.extra_costs - vehicle.taxes;
    const images = parseGallery(vehicle.image_gallery).map((img) => img.url);

    const nextImage = () => {
        if (images.length > 0) {
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }
    };

    const prevImage = () => {
        if (images.length > 0) {
            setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
    };

    return (
        <RecordDrawer
            open
            onClose={onClose}
            size="lg"
            header={
                <RecordHeader
                    title={title}
                    showAvatar={false}
                    subtitle={
                        vehicle.stock_number?.trim()
                            ? `Stock #${vehicle.stock_number}`
                            : undefined
                    }
                    badges={
                        <>
                            <StatusBadge status={vehicle.status} resource="vehicle" />
                            {vehicle.condition && (
                                <Badge variant="subtle" className="text-[11px]">
                                    {vehicle.condition}
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
                    {vehicle.carfax_report_url && (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                            onClick={() => window.open(vehicle.carfax_report_url, "_blank", "noopener,noreferrer")}
                        >
                            CARFAX
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
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
                    {images.length > 0 ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={images[currentImageIndex]}
                                alt={title}
                                className="h-full w-full object-contain"
                            />
                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/50 p-1.5 text-background hover:bg-foreground/70"
                                        aria-label="Previous image"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/50 p-1.5 text-background hover:bg-foreground/70"
                                        aria-label="Next image"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                    <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                                        {images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={`h-1.5 w-1.5 rounded-full ${
                                                    idx === currentImageIndex
                                                        ? "bg-background"
                                                        : "bg-background/50"
                                                }`}
                                                aria-label={`Image ${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                            <ImageIcon className="mb-2 h-10 w-10 opacity-40" />
                            <p className="text-sm">No images</p>
                        </div>
                    )}
                </div>

                <PropertyList title="Vehicle">
                    <PropertyRow label="VIN">
                        <span className="font-mono text-[12px]">{vehicle.vin}</span>
                    </PropertyRow>
                    <PropertyRow label="Trim">
                        {vehicle.trim?.trim() ? vehicle.trim : <PropertyEmpty />}
                    </PropertyRow>
                    <PropertyRow label="Odometer">
                        {vehicle.odometer.toLocaleString()} km
                    </PropertyRow>
                    <PropertyRow label="Stock #">
                        {vehicle.stock_number?.trim() ? vehicle.stock_number : <PropertyEmpty />}
                    </PropertyRow>
                </PropertyList>

                <PropertyList title="Financial">
                    <PropertyRow label="Purchase">{formatCurrency(vehicle.purchase_price)}</PropertyRow>
                    <PropertyRow label="Retail">{formatCurrency(vehicle.retail_price)}</PropertyRow>
                    <PropertyRow label="Extra costs">{formatCurrency(vehicle.extra_costs)}</PropertyRow>
                    <PropertyRow label="Taxes">{formatCurrency(vehicle.taxes)}</PropertyRow>
                    <PropertyRow label="Est. income">
                        <span className={grossProfit >= 0 ? "text-success" : "text-destructive"}>
                            {formatCurrency(grossProfit)}
                        </span>
                    </PropertyRow>
                </PropertyList>

                <ActivityTimeline
                    items={[
                        { id: "created", title: "Added", timestamp: formatDate(vehicle.created_at) },
                        { id: "updated", title: "Updated", timestamp: formatDate(vehicle.updated_at) },
                    ]}
                />
            </div>
        </RecordDrawer>
    );
}
