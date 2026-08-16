import { z } from "zod";

/** Shared intake validation — used by VehicleIntakeWizard step checks. */
export const vehicleIntakeCoreSchema = z.object({
    vin: z
        .string()
        .trim()
        .min(11, "VIN must be at least 11 characters")
        .max(17, "VIN must be 17 characters or fewer"),
    year: z.number().int().min(1980, "Enter a valid year").max(2100),
    make: z.string().trim().min(1, "Select a make"),
    model: z.string().trim().min(1, "Select a model"),
    description: z.string().optional().nullable(),
    internal_notes: z.string().optional().nullable(),
});

export type VehicleIntakeCore = z.infer<typeof vehicleIntakeCoreSchema>;
