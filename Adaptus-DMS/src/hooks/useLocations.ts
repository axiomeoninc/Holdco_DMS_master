"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/src/lib/fetch";

export type DealershipLocation = {
    id: string;
    dealership_id: string;
    name: string;
    code: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    is_active: boolean;
    is_primary: boolean;
    hours: string | null;
};

/**
 * Loads the caller's dealership locations (multi-location Tier 3 feature).
 * Best-effort: returns [] on any failure so existing single-location
 * deployments behave exactly as before.
 */
export function useLocations() {
    const [locations, setLocations] = useState<DealershipLocation[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await apiFetch<{ data: DealershipLocation[] }>(
                "/api/settings/locations",
                { silent: true }
            );
            setLocations(res.data || []);
        } catch {
            setLocations([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return { locations, loading, reload: load };
}
