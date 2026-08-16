/**
 * AutoTrader Canada inventory feed — honest export path.
 * Pipe-delimited field order matches DealerTeam autotrader.ca OFT mapping.
 * Does NOT SFTP/auto-post; dealer downloads and uploads via their AT/HomeNet process.
 */

import { parseGallery } from "@/src/lib/vehicle-image";

export type AutoTraderVehicleInput = {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    odometer?: number | null;
    stock_number?: string | null;
    condition?: string | null;
    status?: string | null;
    retail_price?: number | null;
    exterior_color?: string | null;
    interior_color?: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
    fuel_type?: string | null;
    body_style?: string | null;
    engine?: string | null;
    description?: string | null;
    features?: string[] | null;
    image_gallery?: string[] | null;
    doors?: number | null;
};

export type AutoTraderFeedOptions = {
    /** AutoTrader.ca Company / dealer ID from Location Services */
    companyId?: string;
    /** CategoryID furnished by AutoTrader (dealer-configured) */
    categoryId?: string;
    location?: string;
    inventoryUrlBase?: string;
};

export type AutoTraderFieldIssue = {
    field: string;
    message: string;
    severity: "error" | "warning";
};

export type AutoTraderRowResult = {
    vin: string;
    vehicle_id: string;
    ok: boolean;
    issues: AutoTraderFieldIssue[];
    /** Ordered field values matching AUTOTRADER_CA_COLUMNS */
    values: string[];
};

/** DealerTeam autotrader.ca column order (pipe-delimited, no header row). */
export const AUTOTRADER_CA_COLUMNS = [
    "CategoryID",
    "CompanyID",
    "StockNumber",
    "Vin",
    "Status",
    "Year",
    "Make",
    "Model",
    "Trim",
    "KMS",
    "Exterior Color",
    "Interior Color",
    "FuelType",
    "Drive",
    "Engine Size",
    "Transmission",
    "Doors",
    "Price",
    "Options",
    "Description",
    "MainPhoto",
    "MainPhotoLastModifiedDate",
    "ExtraPhotos",
    "ExtraphotoLastModifiedDate",
    "Displacement",
    "FuelCapacity",
    "Clutch",
    "Location",
    "Torque",
    "Beam",
    "HorsePower",
    "EngineHours",
    "Weight",
    "LengthInInches",
    "BodyType",
    "MSRP",
    "InventoryURL",
] as const;

export type AutoTraderCaColumn = (typeof AUTOTRADER_CA_COLUMNS)[number];

function pipeSafe(value: string | number | null | undefined): string {
    if (value == null) return "";
    return String(value)
        .replace(/\r?\n/g, " ")
        .replace(/\|/g, "/")
        .trim();
}

/** Resolve public http(s) URLs from plain or rich (JSON) image_gallery entries. */
function httpImages(gallery: string[] | null | undefined): string[] {
    return parseGallery(gallery)
        .map((img) => img.url)
        .filter((u) => /^https?:\/\//i.test(u));
}

function mapStatus(status: string | null | undefined): string {
    const s = (status || "").toLowerCase();
    if (s === "sold" || s === "wholesale" || s === "archived") return "Sold";
    if (s === "pending" || s === "in_transit" || s === "incoming") return "Pending";
    return "Available";
}

export function validateAutoTraderVehicle(
    vehicle: AutoTraderVehicleInput,
    opts?: AutoTraderFeedOptions
): AutoTraderFieldIssue[] {
    const issues: AutoTraderFieldIssue[] = [];
    const vin = (vehicle.vin || "").trim();
    if (!vin || vin.length < 11) {
        issues.push({
            field: "Vin",
            message: "VIN is required (11–17 characters)",
            severity: "error",
        });
    }
    if (!vehicle.year || vehicle.year < 1980) {
        issues.push({
            field: "Year",
            message: "Valid year is required",
            severity: "error",
        });
    }
    if (!vehicle.make?.trim()) {
        issues.push({
            field: "Make",
            message: "Make is required",
            severity: "error",
        });
    }
    if (!vehicle.model?.trim()) {
        issues.push({
            field: "Model",
            message: "Model is required",
            severity: "error",
        });
    }
    const price = vehicle.retail_price;
    if (price == null || Number.isNaN(price) || price <= 0) {
        issues.push({
            field: "Price",
            message: "Retail price must be a positive number",
            severity: "error",
        });
    }
    const photos = httpImages(vehicle.image_gallery);
    if (photos.length === 0) {
        issues.push({
            field: "MainPhoto",
            message: "At least one public http(s) photo URL is required",
            severity: "error",
        });
    }
    if (!opts?.companyId?.trim()) {
        issues.push({
            field: "CompanyID",
            message:
                "Set AutoTrader Company ID under Business settings (settings.autotrader_company_id) before partner upload",
            severity: "warning",
        });
    }
    if (!opts?.categoryId?.trim()) {
        issues.push({
            field: "CategoryID",
            message:
                "CategoryID empty — set settings.autotrader_category_id from AutoTrader if your partner requires it",
            severity: "warning",
        });
    }
    if (vehicle.odometer == null) {
        issues.push({
            field: "KMS",
            message: "Odometer (KMS) missing",
            severity: "warning",
        });
    }
    return issues;
}

export function buildAutoTraderRow(
    vehicle: AutoTraderVehicleInput,
    opts?: AutoTraderFeedOptions
): AutoTraderRowResult {
    const issues = validateAutoTraderVehicle(vehicle, opts);
    const photos = httpImages(vehicle.image_gallery);
    const main = photos[0] || "";
    const extra = photos.slice(1).join(",");
    const options =
        Array.isArray(vehicle.features) && vehicle.features.length > 0
            ? vehicle.features.slice(0, 40).join(",")
            : "";
    const inventoryUrl =
        opts?.inventoryUrlBase && vehicle.vin
            ? `${opts.inventoryUrlBase.replace(/\/$/, "")}/${encodeURIComponent(vehicle.vin)}`
            : "";

    const byCol: Record<AutoTraderCaColumn, string> = {
        CategoryID: pipeSafe(opts?.categoryId),
        CompanyID: pipeSafe(opts?.companyId),
        StockNumber: pipeSafe(vehicle.stock_number),
        Vin: pipeSafe(vehicle.vin),
        Status: pipeSafe(mapStatus(vehicle.status)),
        Year: pipeSafe(vehicle.year),
        Make: pipeSafe(vehicle.make),
        Model: pipeSafe(vehicle.model),
        Trim: pipeSafe(vehicle.trim),
        KMS: pipeSafe(vehicle.odometer),
        "Exterior Color": pipeSafe(vehicle.exterior_color),
        "Interior Color": pipeSafe(vehicle.interior_color),
        FuelType: pipeSafe(vehicle.fuel_type),
        Drive: pipeSafe(vehicle.drivetrain),
        "Engine Size": pipeSafe(vehicle.engine),
        Transmission: pipeSafe(vehicle.transmission),
        Doors: pipeSafe(vehicle.doors),
        Price: pipeSafe(
            vehicle.retail_price != null
                ? Math.round(vehicle.retail_price)
                : ""
        ),
        Options: pipeSafe(options),
        Description: pipeSafe(vehicle.description),
        MainPhoto: pipeSafe(main),
        MainPhotoLastModifiedDate: "",
        ExtraPhotos: pipeSafe(extra),
        ExtraphotoLastModifiedDate: "",
        Displacement: "",
        FuelCapacity: "",
        Clutch: "",
        Location: pipeSafe(opts?.location),
        Torque: "",
        Beam: "",
        HorsePower: "",
        EngineHours: "",
        Weight: "",
        LengthInInches: "",
        BodyType: pipeSafe(vehicle.body_style),
        MSRP: "",
        InventoryURL: pipeSafe(inventoryUrl),
    };

    const values = AUTOTRADER_CA_COLUMNS.map((c) => byCol[c]);
    const ok = !issues.some((i) => i.severity === "error");

    return {
        vin: vehicle.vin,
        vehicle_id: vehicle.id,
        ok,
        issues,
        values,
    };
}

/** Pipe-delimited body with no header row (AT.ca partner style). */
export function autoTraderRowsToPipeFeed(rows: AutoTraderRowResult[]): string {
    return rows
        .filter((r) => r.ok)
        .map((r) => r.values.join("|"))
        .join("\n");
}

/** CSV with header row for dealer inspection / spreadsheet upload. */
export function autoTraderRowsToCsv(rows: AutoTraderRowResult[]): string {
    const escape = (v: string) => {
        if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
        return v;
    };
    const header = AUTOTRADER_CA_COLUMNS.join(",");
    const lines = rows
        .filter((r) => r.ok)
        .map((r) => r.values.map(escape).join(","));
    return [header, ...lines].join("\n");
}

export type AutoTraderPackMeta = {
    board: "autotrader";
    format_version: 1;
    generated_at: string;
    honest_mvp: true;
    note: string;
    included: number;
    skipped: number;
    rows: Array<{
        vin: string;
        vehicle_id: string;
        ok: boolean;
        issues: AutoTraderFieldIssue[];
    }>;
};

export function buildAutoTraderPackMeta(
    rows: AutoTraderRowResult[]
): AutoTraderPackMeta {
    const included = rows.filter((r) => r.ok).length;
    return {
        board: "autotrader",
        format_version: 1,
        generated_at: new Date().toISOString(),
        honest_mvp: true,
        note: "Download feed/CSV and upload via your AutoTrader Canada / HomeNet process. AdaptUs does not SFTP or auto-list.",
        included,
        skipped: rows.length - included,
        rows: rows.map(({ vin, vehicle_id, ok, issues }) => ({
            vin,
            vehicle_id,
            ok,
            issues,
        })),
    };
}

export function readAutoTraderOptsFromSettings(
    settings: Record<string, unknown> | null | undefined
): AutoTraderFeedOptions {
    const s = settings || {};
    const companyId =
        typeof s.autotrader_company_id === "string"
            ? s.autotrader_company_id
            : typeof s.autotrader_companyId === "string"
              ? s.autotrader_companyId
              : undefined;
    const categoryId =
        typeof s.autotrader_category_id === "string"
            ? s.autotrader_category_id
            : typeof s.autotrader_categoryId === "string"
              ? s.autotrader_categoryId
              : undefined;
    const location =
        typeof s.city === "string"
            ? s.city
            : typeof s.location === "string"
              ? s.location
              : undefined;
    return { companyId, categoryId, location };
}
