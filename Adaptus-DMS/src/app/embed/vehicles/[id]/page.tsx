import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { maskVinForPublic } from "@/src/lib/public-inventory";
import { vehicleJsonLd, vehicleJsonLdHtml } from "@/src/lib/vehicle-jsonld";

type PageProps = { params: Promise<{ id: string }> };

type VehicleRow = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
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
  stock_number: string | null;
  image_gallery: string[];
  images?: string | string[] | null;
  description: string | null;
  features: string[];
  status: string;
  dealership_id: string;
};

function galleryUrls(row: VehicleRow): string[] {
  const gallery = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const imagesField = typeof row.images === "string" ? row.images : null;
  const photos = gallery.length
    ? gallery.filter((u): u is string => typeof u === "string" && u.length > 0)
    : imagesField
      ? [imagesField]
      : [];
  return photos;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select(
      "id, year, make, model, trim, status, dealership_id, description, retail_price, special_price"
    )
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) return { title: "Vehicle not found" };
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");
  const price = vehicle.special_price ?? vehicle.retail_price;
  return {
    title,
    description:
      vehicle.description?.slice(0, 160) ||
      `${title} at ${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}.`,
    ...(price != null
      ? { openGraph: { title, description: `Available for $${price.toLocaleString()} CAD` } }
      : {}),
  };
}

export default async function PublicVehiclePage({ params }: PageProps) {
  const { id } = await params;

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select(
      "id, vin, year, make, model, trim, odometer, condition, exterior_color, interior_color, fuel_type, transmission, drivetrain, body_style, retail_price, special_price, stock_number, image_gallery, images, description, features, status, dealership_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!vehicle) notFound();

  const row = vehicle as unknown as VehicleRow;
  if (row.status !== "Active") notFound();

  const { data: dealership } = await supabaseAdmin
    .from("dealerships")
    .select("id, name, business_name, status, slug")
    .eq("id", row.dealership_id)
    .maybeSingle();
  if (!dealership || dealership.status !== "Active") notFound();

  const photos = galleryUrls(row);
  const price = row.special_price ?? row.retail_price;
  const dealershipName = dealership.business_name || dealership.name;
  const slug = typeof dealership.slug === "string" && dealership.slug ? dealership.slug : null;

  const jsonLd = vehicleJsonLd(
    {
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      odometer: row.odometer,
      condition: row.condition,
      exterior_color: row.exterior_color,
      interior_color: row.interior_color,
      fuel_type: row.fuel_type,
      transmission: row.transmission,
      drivetrain: row.drivetrain,
      body_style: row.body_style,
      retail_price: row.retail_price,
      special_price: row.special_price,
      photos,
      description: row.description,
      features: row.features,
      vin_masked: maskVinForPublic(row.vin),
      stock_number: row.stock_number,
    },
    {
      dealershipName,
      priceCurrency: "CAD",
      url: `/embed/vehicles/${row.id}`,
    }
  );

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: vehicleJsonLdHtml(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-xs text-slate-500">
          {dealershipName} · Inventory
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {row.year} {row.make} {row.model}
          {row.trim ? ` ${row.trim}` : ""}
        </h1>
        {price != null && (
          <p className="mt-2 text-xl font-semibold tabular-nums">
            ${price.toLocaleString()} CAD
          </p>
        )}
        {slug ? (
          <p className="mt-3">
            <a
              href={`/showroom/${encodeURIComponent(slug)}?vehicle=${encodeURIComponent(row.id)}#contact-heading`}
              className="inline-flex h-9 items-center rounded-md bg-[#00AEEF] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Enquire
            </a>
          </p>
        ) : null}
        {photos.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[0]}
              alt={`${row.year} ${row.make} ${row.model}`}
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Stock" value={row.stock_number} />
          <Spec label="Odometer" value={row.odometer != null ? `${row.odometer.toLocaleString()} km` : undefined} />
          <Spec label="Condition" value={row.condition} />
          <Spec label="Exterior" value={row.exterior_color} />
          <Spec label="Interior" value={row.interior_color} />
          <Spec label="Fuel" value={row.fuel_type} />
          <Spec label="Transmission" value={row.transmission} />
          <Spec label="Drivetrain" value={row.drivetrain} />
          <Spec label="Body" value={row.body_style} />
        </dl>
        {row.description ? (
          <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {row.description}
          </p>
        ) : null}
        {Array.isArray(row.features) && row.features.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {row.features.map((f) => (
              <li key={f} className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium">
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Spec({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">
        {value && String(value).trim() !== "" ? value : "—"}
      </dd>
    </div>
  );
}
