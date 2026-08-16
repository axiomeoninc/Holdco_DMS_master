"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import type { ShowroomVehicle } from "@/src/lib/showroom";

type ShowroomVehicleCardProps = {
  vehicle: ShowroomVehicle;
  dealershipName: string;
  slug: string;
};

export default function ShowroomVehicleCard({
  vehicle,
  dealershipName,
  slug,
}: ShowroomVehicleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const price = vehicle.special_price ?? vehicle.retail_price;
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors hover:border-white/25">
      {vehicle.photo ? (
        <div className="aspect-[16/10] overflow-hidden bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vehicle.photo}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-black/30 text-white/30">
          No photo
        </div>
      )}

      <div className="p-4">
        <h3 className="text-sm font-semibold text-white">{title || "Vehicle"}</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/60">
          {vehicle.odometer != null && (
            <div className="flex justify-between">
              <dt>Odometer</dt>
              <dd className="text-white/80">{vehicle.odometer.toLocaleString()} km</dd>
            </div>
          )}
          {vehicle.fuel_type && (
            <div className="flex justify-between">
              <dt>Fuel</dt>
              <dd className="text-white/80">{vehicle.fuel_type}</dd>
            </div>
          )}
          {vehicle.transmission && (
            <div className="flex justify-between">
              <dt>Transmission</dt>
              <dd className="text-white/80">{vehicle.transmission}</dd>
            </div>
          )}
          {vehicle.exterior_color && (
            <div className="flex justify-between">
              <dt>Exterior</dt>
              <dd className="text-white/80">{vehicle.exterior_color}</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-base font-bold tabular-nums text-white">
            {price != null ? `$${price.toLocaleString()}` : "Call for price"}
          </p>
          {vehicle.stock_number && (
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Stock {vehicle.stock_number}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <a
            href="#contact-heading"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("contact-heading")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition-opacity hover:opacity-90"
          >
            Ask about this vehicle
          </a>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
          >
            <MapPin className="h-3 w-3" />
            {expanded ? "Less" : "Details"}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs text-white/70">
            <p>
              <span className="text-white/45">Condition:</span>{" "}
              {vehicle.condition || "—"}
            </p>
            <p>
              <span className="text-white/45">Drivetrain:</span>{" "}
              {vehicle.drivetrain || "—"}
            </p>
            <p>
              <span className="text-white/45">Body style:</span>{" "}
              {vehicle.body_style || "—"}
            </p>
            {vehicle.description ? (
              <p className="whitespace-pre-line text-white/60">{vehicle.description}</p>
            ) : null}
            <p className="text-[11px] text-white/40">
              {dealershipName} · {slug}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
