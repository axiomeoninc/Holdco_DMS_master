/**
 * Dealer showroom (hosted microsite) — shared server-side helpers.
 *
 * The showroom is a hosted single-page dealership site that reuses the same
 * public inventory data source as the embed widget (`/api/vehicles/public`)
 * and the schema.org Vehicle JSON-LD builder. Only PUBLIC, non-financial
 * vehicle data is served; full VINs are masked and sold/deal records are
 * never touched.
 */

import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { vehicleJsonLd, type VehicleJsonLdInput } from "@/src/lib/vehicle-jsonld";

export type ShowroomDealership = {
  id: string;
  name: string;
  business_name: string | null;
  slug: string | null;
  logo_url: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  settings: Record<string, unknown> | null;
  status: string | null;
};

export type ShowroomVehicle = {
  id: string;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  stock_number: string | null;
  vin_masked: string | null;
  odometer: number | null;
  condition: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  fuel_type: string | null;
  transmission: string | null;
  drivetrain: string | null;
  body_style: string | null;
  retail_price: number | null;
  special_price: number | null;
  photos: string[];
  photo: string | null;
  description: string | null;
  features: string[];
};

const SHOWROOM_COLUMNS =
  "id, year, make, model, trim, stock_number, vin, odometer, condition, exterior_color, interior_color, fuel_type, transmission, drivetrain, body_style, retail_price, special_price, image_gallery, images, description, features, status, dealership_id, created_at";

function truncateVin(vin: string | null | undefined): string | null {
  if (!vin || typeof vin !== "string") return null;
  if (vin.length <= 8) return vin;
  return `${vin.slice(0, 4)}…${vin.slice(-4)}`;
}

/** Resolve a dealership by its public slug. Returns null when unknown/inactive. */
export async function getShowroomDealership(
  slug: string
): Promise<ShowroomDealership | null> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select(
      "id, name, business_name, slug, logo_url, business_address, business_phone, business_email, settings, status"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as ShowroomDealership;
}

/** Whether the dealership is open to the public (Active only). */
export function isShowroomOpen(dealership: ShowroomDealership | null): boolean {
  if (!dealership) return false;
  return dealership.status === "Active";
}

function galleryUrls(row: Record<string, unknown>): string[] {
  const gallery = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const imagesField = typeof row.images === "string" ? row.images : null;
  const photos =
    gallery.length > 0
      ? gallery.filter((u): u is string => typeof u === "string" && u.length > 0)
      : imagesField
        ? [imagesField]
        : [];
  return photos;
}

/** Public vehicle shape — mirrors the embed API so the showroom stays consistent. */
function publicVehicleShape(row: Record<string, unknown>): ShowroomVehicle {
  const photos = galleryUrls(row);
  return {
    id: String(row.id),
    year: row.year as number | null,
    make: String(row.make ?? ""),
    model: String(row.model ?? ""),
    trim: (row.trim as string | null) ?? null,
    stock_number: (row.stock_number as string | null) ?? null,
    vin_masked: truncateVin(row.vin as string | undefined),
    odometer: (row.odometer as number | null) ?? null,
    condition: (row.condition as string | null) ?? null,
    exterior_color: (row.exterior_color as string | null) ?? null,
    interior_color: (row.interior_color as string | null) ?? null,
    fuel_type: (row.fuel_type as string | null) ?? null,
    transmission: (row.transmission as string | null) ?? null,
    drivetrain: (row.drivetrain as string | null) ?? null,
    body_style: (row.body_style as string | null) ?? null,
    retail_price: (row.retail_price as number | null) ?? null,
    special_price: (row.special_price as number | null) ?? null,
    photos,
    photo: photos[0] ?? null,
    description: (row.description as string | null) ?? null,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
  };
}

/** Featured active inventory for a dealership (public data only). */
export async function getShowroomInventory(
  dealershipId: string,
  limit = 12
): Promise<ShowroomVehicle[]> {
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select(SHOWROOM_COLUMNS)
    .eq("dealership_id", dealershipId)
    .eq("status", "Active")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) return [];
  return (data || []).map((row) =>
    publicVehicleShape(row as Record<string, unknown>)
  );
}

/** schema.org Vehicle JSON-LD for showroom vehicles. */
export function showroomVehicleJsonLd(
  v: ShowroomVehicle,
  opts: { url?: string; dealershipName?: string | null } = {}
): Record<string, unknown> {
  return vehicleJsonLd(v as VehicleJsonLdInput, opts);
}
