"use client";

import { use } from "react";
import VehicleIntakeWizard from "@/src/components/VehicleIntakeWizard";

export default function EditVehiclePage({
    params,
}: {
    params: Promise<{ vin: string }>;
}) {
    const { vin } = use(params);
    return <VehicleIntakeWizard mode="edit" vin={decodeURIComponent(vin)} />;
}
