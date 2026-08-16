"use client";

/**
 * @deprecated Use VehicleIntakeWizard via `/inventory/add`, `/inventory/new`, or `/inventory/[vin]/edit`.
 * Thin redirect wrapper kept so any remaining imports still work.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PENDING_VIN_SPECS_KEY } from "@/src/lib/pending-vin-specs";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface Vehicle {
    id: string;
    vin: string;
    [key: string]: unknown;
}

interface VehicleFormModalProps {
    mode: "add" | "edit";
    vehicle?: Vehicle | null;
    onClose: () => void;
    onSuccess: () => void;
    pendingVinSpecs?: {
        vin: string;
        year?: number;
        make?: string;
        model?: string;
        trim?: string;
        engine?: string;
        body_style?: string;
        fuel_type?: string;
        transmission?: string;
        drivetrain?: string;
        exterior_color?: string;
        interior_color?: string;
    } | null;
}

export default function VehicleFormModal({
    mode,
    vehicle,
    onClose,
    pendingVinSpecs,
}: VehicleFormModalProps) {
    useOverlayDismiss(onClose);

    const router = useRouter();

    useEffect(() => {
        if (mode === "edit" && vehicle?.vin) {
            router.replace(`/inventory/${encodeURIComponent(vehicle.vin)}/edit`);
            return;
        }

        if (pendingVinSpecs) {
            try {
                sessionStorage.setItem(PENDING_VIN_SPECS_KEY, JSON.stringify(pendingVinSpecs));
            } catch {
                // ignore quota / private mode
            }
        }
        router.replace("/inventory/add");
    }, [mode, vehicle, pendingVinSpecs, router]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-5 shadow-lg">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Opening vehicle intake…</p>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-muted-foreground underline"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
