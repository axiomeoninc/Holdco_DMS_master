/**
 * Vehicle photo object paths are always `{dealership_id}/{vin}/…`.
 * Never `{vin}/` — that collides when two rooftops share a VIN.
 */

export class UnprefixedVehicleStorageError extends Error {
    constructor(message = "dealership_id required for vehicle storage path") {
        super(message);
        this.name = "UnprefixedVehicleStorageError";
    }
}

export function vehicleStorageFolder(
    dealershipId: string | null | undefined,
    vin: string
): string {
    const rooftop = typeof dealershipId === "string" ? dealershipId.trim() : "";
    const key = typeof vin === "string" ? vin.trim() : "";
    if (!rooftop) {
        throw new UnprefixedVehicleStorageError();
    }
    if (!key) {
        throw new UnprefixedVehicleStorageError("vin required for vehicle storage path");
    }
    return `${rooftop}/${key}`;
}

export function vehicleStorageObjectPath(
    dealershipId: string | null | undefined,
    vin: string,
    filename: string
): string {
    const safe = filename.replace(/[^\w.\-]/g, "_");
    return `${vehicleStorageFolder(dealershipId, vin)}/${safe}`;
}

const PUBLIC_MARKER = "/object/public/vehicles/";

/** Object key inside the `vehicles` bucket, or null if the URL is not ours. */
export function parseVehiclesBucketPath(url: string): string | null {
    if (!url) return null;
    const i = url.indexOf(PUBLIC_MARKER);
    if (i < 0) return null;
    const raw = url.slice(i + PUBLIC_MARKER.length).split("?")[0];
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function isDealershipPrefixedObjectPath(
    objectPath: string,
    dealershipId: string
): boolean {
    return objectPath.startsWith(`${dealershipId}/`);
}
