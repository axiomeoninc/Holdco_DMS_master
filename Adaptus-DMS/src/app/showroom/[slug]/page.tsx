import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import {
  getShowroomDealership,
  getShowroomInventory,
  isShowroomOpen,
  showroomVehicleJsonLd,
} from "@/src/lib/showroom";
import { vehicleJsonLdHtml } from "@/src/lib/vehicle-jsonld";
import ShowroomLeadForm from "./lead-form";
import ShowroomVehicleCard from "./vehicle-card";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ vehicle?: string }> };

function displayName(dealership: {
  business_name: string | null;
  name: string;
}): string {
  return dealership.business_name || dealership.name;
}

async function loadShowroom(slug: string) {
  const dealership = await getShowroomDealership(slug);
  if (!dealership || !isShowroomOpen(dealership)) return null;

  const inventory = await getShowroomInventory(dealership.id, 12);

  const settings = (dealership.settings || {}) as Record<string, unknown>;
  const hours =
    typeof settings.hours === "string" && settings.hours.trim()
      ? settings.hours.trim()
      : null;
  const tagline =
    typeof settings.tagline === "string" && settings.tagline.trim()
      ? settings.tagline.trim()
      : null;
  const heroNote =
    typeof settings.showroom_note === "string" && settings.showroom_note.trim()
      ? settings.showroom_note.trim()
      : null;

  return { dealership, inventory, hours, tagline, heroNote };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadShowroom(slug);
  if (!data) {
    return { title: "Showroom not found", robots: { index: false, follow: false } };
  }
  const name = displayName(data.dealership);
  return {
    title: `${name} — Digital Showroom`,
    description:
      data.tagline ||
      `Browse featured vehicles from ${name}. Request details online and a team member will get back to you.`,
    robots: { index: true, follow: true },
  };
}

export default async function ShowroomPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadShowroom(slug);
  if (!data) notFound();

  const { dealership, inventory, hours, tagline, heroNote } = data;
  const name = displayName(dealership);
  const initialVehicleId = sp.vehicle?.trim() || null;

  // Vehicle JSON-LD for LLM-shopper visibility (schema.org Vehicle listings).
  const jsonLdNodes = inventory.map((v) =>
    showroomVehicleJsonLd(v, {
      dealershipName: name,
      url: `/showroom/${slug}?vehicle=${v.id}`,
    })
  );

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0a0e1a] text-white antialiased">
      {/* Dark-glass ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 500px at 15% -10%, rgba(37,99,235,0.28), transparent 60%), radial-gradient(900px 480px at 90% 5%, rgba(16,185,129,0.16), transparent 55%), linear-gradient(180deg, #0a0e1a 0%, #0d1226 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 backdrop-blur-[2px]" />

      {jsonLdNodes.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: vehicleJsonLdHtml(
              jsonLdNodes.length === 1 ? jsonLdNodes[0] : jsonLdNodes
            ),
          }}
        />
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-3">
            {dealership.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dealership.logo_url}
                alt={`${name} logo`}
                className="h-10 w-10 rounded-lg bg-white/10 object-contain p-1"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 text-sm font-bold">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                Digital showroom
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
            {dealership.business_phone && (
              <a
                href={`tel:${dealership.business_phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                <Phone className="h-3.5 w-3.5" />
                {dealership.business_phone}
              </a>
            )}
            {dealership.business_email && (
              <a
                href={`mailto:${dealership.business_email}`}
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                <Mail className="h-3.5 w-3.5" />
                {dealership.business_email}
              </a>
            )}
          </div>
        </header>

        {/* Hero */}
        <section className="py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
            {tagline || "Featured inventory"}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Find your next vehicle at {name}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            {heroNote ||
              `Browse featured inventory from ${name}. Request details below and a team member will get back to you during business hours.`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
            {dealership.business_address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {dealership.business_address}
              </span>
            )}
            {hours && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {hours}
              </span>
            )}
          </div>
        </section>

        {/* Featured inventory */}
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="text-lg font-semibold tracking-tight">
            Featured vehicles
          </h2>
          {inventory.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
              <p className="text-sm text-white/60">
                Inventory is being refreshed. Check back soon or use the contact form below.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inventory.map((vehicle) => (
                <ShowroomVehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  dealershipName={name}
                  slug={slug}
                />
              ))}
            </div>
          )}
        </section>

        {/* Contact / lead capture */}
        <section aria-labelledby="contact-heading" className="py-14">
          <h2 id="contact-heading" className="text-lg font-semibold tracking-tight">
            Contact {name}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Tell us what you&apos;re looking for and we&apos;ll follow up. Consent is required for
            marketing contact; we never send unsolicited messages.
          </p>
          <div className="mt-5 max-w-xl">
            <ShowroomLeadForm
              dealershipId={dealership.id}
              slug={slug}
              dealershipName={name}
              initialVehicleId={initialVehicleId}
            />
          </div>
        </section>

        <footer className="border-t border-white/10 py-6 text-center text-[11px] text-white/40">
          {name} · Digital showroom by FlashFender
        </footer>
      </div>
    </main>
  );
}
