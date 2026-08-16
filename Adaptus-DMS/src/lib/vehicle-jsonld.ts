/**
 * schema.org Vehicle JSON-LD builder — shared by the public embed, the public
 * listing page, and unit listing pages so LLM-shoppers can parse inventory.
 *
 * Uses the schema.org "Car" type (a subtype of Vehicle) with offers, mileage,
 * color, fuel, and drive train fields. Full VINs are NEVER exposed; the masked
 * VIN is included when available.
 */

export type VehicleJsonLdInput = {
  year: number | null;
  make: string;
  model: string;
  trim?: string | null;
  odometer?: number | null;
  condition?: string | null;
  exterior_color?: string | null;
  interior_color?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  body_style?: string | null;
  retail_price?: number | null;
  special_price?: number | null;
  photos?: string[];
  description?: string | null;
  features?: string[];
  vin_masked?: string | null;
  stock_number?: string | null;
  itemCondition?: string | null;
  image?: string | null;
};

function pickUnit(value?: string | null): string | null {
  const v = (value || "").toLowerCase();
  if (v.includes("mi")) return "SMI";
  return "KMT";
}

export function vehicleJsonLd(
  v: VehicleJsonLdInput,
  opts: { url?: string; dealershipName?: string | null; priceCurrency?: string } = {}
): Record<string, unknown> {
  const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  const price =
    v.special_price != null ? v.special_price : v.retail_price;
  const currency = opts.priceCurrency || "CAD";
  const photos = v.photos?.length ? v.photos : v.image ? [v.image] : [];

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Car",
    name,
    ...(v.make ? { brand: { "@type": "Brand", name: v.make } } : {}),
    ...(v.model ? { model: v.model } : {}),
    ...(v.trim ? { vehicleConfiguration: v.trim } : {}),
    ...(v.year ? { vehicleModelDate: String(v.year) } : {}),
    ...(v.body_style
      ? { bodyType: v.body_style }
      : {}),
    ...(v.fuel_type ? { fuelType: v.fuel_type } : {}),
    ...(v.transmission ? { vehicleTransmission: v.transmission } : {}),
    ...(v.drivetrain ? { driveWheelConfiguration: v.drivetrain } : {}),
    ...(v.exterior_color ? { color: v.exterior_color } : {}),
    ...(v.interior_color ? { interiorColor: v.interior_color } : {}),
    ...(v.stock_number ? { sku: v.stock_number } : {}),
    ...(v.vin_masked ? { vehicleIdentificationNumber: v.vin_masked } : {}),
    ...(photos.length ? { image: photos } : {}),
    ...(v.description ? { description: v.description } : {}),
    ...(v.features?.length ? { vehicleSpecialUsage: v.features } : {}),
  };

  if (v.odometer != null) {
    node.mileageFromOdometer = {
      "@type": "QuantitativeValue",
      value: v.odometer,
      unitCode: pickUnit(v.condition),
    };
  }

  const conditionMap: Record<string, string> = {
    new: "https://schema.org/NewCondition",
    used: "https://schema.org/UsedCondition",
    "certified pre-owned": "https://schema.org/UsedCondition",
    cpo: "https://schema.org/UsedCondition",
  };
  const condition =
    v.itemCondition || (v.condition ? conditionMap[v.condition.toLowerCase()] : undefined);
  if (condition) node.itemCondition = condition;

  if (price != null) {
    node.offers = {
      "@type": "Offer",
      priceCurrency: currency,
      price: price,
      availability: "https://schema.org/InStock",
      ...(opts.url ? { url: opts.url } : {}),
    };
  }

  return node;
}

/** Serialize for a <script type="application/ld+json"> block. */
export function vehicleJsonLdHtml(nodes: Record<string, unknown> | Record<string, unknown>[]): string {
  const payload = Array.isArray(nodes) && nodes.length === 1 ? nodes[0] : nodes;
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
