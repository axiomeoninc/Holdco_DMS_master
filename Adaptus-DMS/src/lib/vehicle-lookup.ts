import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVehicleUuid(value: string): boolean {
    return UUID_RE.test(value);
}

export const VIN_LOOKUP_NO_CONTEXT = "No dealership context";
export const VIN_LOOKUP_NEEDS_ACT_AS = "Act as dealership required";

export type VehicleLookupResult<T> = {
    vehicle: T | null;
    ambiguous: boolean;
    error: string | null;
};

/**
 * Resolve a vehicle by VIN (or UUID) scoped to a rooftop.
 * VIN is unique per dealership_id, not globally — never `.eq("vin").single()`
 * without a rooftop filter when using the service-role client.
 */
export async function findVehicleByVinOrId<T = Record<string, unknown>>(
    supabase: SupabaseClient,
    rawKey: string,
    opts: {
        dealershipId?: string | null;
        isPlatformAdmin?: boolean;
        select?: string;
    }
): Promise<VehicleLookupResult<T>> {
    const key = decodeURIComponent(rawKey).trim();
    if (!key) return { vehicle: null, ambiguous: false, error: "Missing vehicle key" };

    const select = opts.select ?? "id, vin, dealership_id";
    const rooftop = opts.dealershipId || null;

    if (isVehicleUuid(key)) {
        let q = supabase.from("vehicles").select(select).eq("id", key);
        if (rooftop) q = q.eq("dealership_id", rooftop);
        const { data, error } = await q.maybeSingle();
        if (error) return { vehicle: null, ambiguous: false, error: error.message };
        return { vehicle: (data as T) ?? null, ambiguous: false, error: null };
    }

    if (!rooftop) {
        return {
            vehicle: null,
            ambiguous: false,
            error: opts.isPlatformAdmin ? VIN_LOOKUP_NEEDS_ACT_AS : VIN_LOOKUP_NO_CONTEXT,
        };
    }

    const { data, error } = await supabase
        .from("vehicles")
        .select(select)
        .eq("vin", key)
        .eq("dealership_id", rooftop)
        .maybeSingle();
    if (error) return { vehicle: null, ambiguous: false, error: error.message };
    return { vehicle: (data as T) ?? null, ambiguous: false, error: null };
}
