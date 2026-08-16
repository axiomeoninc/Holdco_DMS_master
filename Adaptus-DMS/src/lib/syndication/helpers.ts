/**
 * Shared syndication helpers (Kijiji + AutoTrader Canada).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    buildAutoTraderRow,
    readAutoTraderOptsFromSettings,
    type AutoTraderFeedOptions,
    type AutoTraderRowResult,
    type AutoTraderVehicleInput,
} from "./autotrader";

export const SYNDICATION_VEHICLE_SELECT = `
id, vin, year, make, model, trim, odometer, stock_number, condition, status,
retail_price, exterior_color, interior_color, transmission, drivetrain,
fuel_type, body_style, engine, description, features, carfax_report_url,
image_gallery, doors, passengers, dealership_id
`;

export type SyndicationDealerContext = {
    city?: string;
    province?: string;
    autotrader: AutoTraderFeedOptions;
    settings: Record<string, unknown>;
    dealershipId: string;
};

export async function loadDealershipSyndicationContext(
    supabase: SupabaseClient,
    dealershipId: string
): Promise<SyndicationDealerContext> {
    const { data: dealer } = await supabase
        .from("dealerships")
        .select("id, business_address, settings")
        .eq("id", dealershipId)
        .maybeSingle();

    const settings = (dealer?.settings || {}) as Record<string, unknown>;
    let city =
        (typeof settings.city === "string" && settings.city) || undefined;
    const province =
        (typeof settings.province === "string" && settings.province) || "ON";
    if (!city && typeof dealer?.business_address === "string") {
        city = dealer.business_address.split(",")[0]?.trim();
    }

    const autotrader = readAutoTraderOptsFromSettings(settings);
    if (city && !autotrader.location) {
        autotrader.location = city;
    }

    return {
        city,
        province,
        autotrader,
        settings,
        dealershipId,
    };
}

export function vehicleToAutoTraderInput(
    vehicle: Record<string, unknown>
): AutoTraderVehicleInput {
    return {
        id: String(vehicle.id),
        vin: String(vehicle.vin || ""),
        year: Number(vehicle.year),
        make: String(vehicle.make || ""),
        model: String(vehicle.model || ""),
        trim: (vehicle.trim as string | null) ?? null,
        odometer: (vehicle.odometer as number | null) ?? null,
        stock_number: (vehicle.stock_number as string | null) ?? null,
        condition: (vehicle.condition as string | null) ?? null,
        status: (vehicle.status as string | null) ?? null,
        retail_price: (vehicle.retail_price as number | null) ?? null,
        exterior_color: (vehicle.exterior_color as string | null) ?? null,
        interior_color: (vehicle.interior_color as string | null) ?? null,
        transmission: (vehicle.transmission as string | null) ?? null,
        drivetrain: (vehicle.drivetrain as string | null) ?? null,
        fuel_type: (vehicle.fuel_type as string | null) ?? null,
        body_style: (vehicle.body_style as string | null) ?? null,
        engine: (vehicle.engine as string | null) ?? null,
        description: (vehicle.description as string | null) ?? null,
        features: (vehicle.features as string[] | null) ?? null,
        image_gallery: (vehicle.image_gallery as string[] | null) ?? null,
        doors: (vehicle.doors as number | null) ?? null,
    };
}

export function buildAutoTraderRowsForVehicles(
    vehicles: Record<string, unknown>[],
    opts: AutoTraderFeedOptions
): AutoTraderRowResult[] {
    return vehicles.map((v) =>
        buildAutoTraderRow(vehicleToAutoTraderInput(v), opts)
    );
}

export async function recordSyndicationExport(
    supabase: SupabaseClient,
    dealershipId: string,
    currentSettings: Record<string, unknown>,
    payload: {
        board: "autotrader" | "kijiji";
        included: number;
        skipped: number;
        vins: string[];
    }
): Promise<void> {
    const prev =
        typeof currentSettings.syndication === "object" &&
        currentSettings.syndication !== null
            ? (currentSettings.syndication as Record<string, unknown>)
            : {};
    const boardPrev =
        typeof prev[payload.board] === "object" && prev[payload.board] !== null
            ? (prev[payload.board] as Record<string, unknown>)
            : {};

    const nextSettings = {
        ...currentSettings,
        syndication: {
            ...prev,
            [payload.board]: {
                ...boardPrev,
                last_export_at: new Date().toISOString(),
                last_export_count: payload.included,
                last_export_skipped: payload.skipped,
                last_export_vins: payload.vins.slice(0, 50),
            },
        },
    };

    await supabase
        .from("dealerships")
        .update({ settings: nextSettings })
        .eq("id", dealershipId);
}
