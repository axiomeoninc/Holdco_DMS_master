"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { firstImageUrl, resolveGallery } from "@/src/lib/vehicle-image";
import { daysInStock } from "@/src/lib/estimated-income";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    odometer: number;
    stock_number: string | null;
    condition: string;
    status: string;
    retail_price: number;
    special_price?: number | null;
    exterior_color?: string | null;
    interior_color?: string | null;
    fuel_type?: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
    body_style?: string | null;
    image_gallery: string[];
    images?: string | string[] | null;
    created_at: string;
}

function money(n: number) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
    }).format(n || 0);
}

/**
 * Window sticker / lot label — open from inventory row or VDP, then Print.
 * Print CSS hides chrome; designed for letter or landscape sticker stock.
 */
export default function VehiclePrintStickerPage() {
    const params = useParams<{ vin: string }>();
    const vin = decodeURIComponent(params.vin);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/vehicles?vin=${encodeURIComponent(vin)}&limit=1`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to load vehicle");
            const json = await res.json();
            const row = (json.data as Vehicle[] | undefined)?.[0];
            if (!row) throw new Error("Vehicle not found");
            setVehicle(row);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Load failed");
        } finally {
            setLoading(false);
        }
    }, [vin]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!vehicle) return;
        const t = setTimeout(() => {
            try {
                window.print();
            } catch {
                // ignore
            }
        }, 400);
        return () => clearTimeout(t);
    }, [vehicle]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center gap-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing sticker…
            </div>
        );
    }

    if (error || !vehicle) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6">
                <p className="text-sm text-red-600">{error || "Not found"}</p>
                <button
                    type="button"
                    onClick={() => void load()}
                    className="rounded-md border px-3 py-2 text-sm"
                >
                    Retry
                </button>
            </div>
        );
    }

    const gallery = resolveGallery(vehicle.image_gallery, vehicle.images);
    const photo = firstImageUrl(vehicle.image_gallery) || gallery[0]?.url || null;
    const price = vehicle.special_price && vehicle.special_price > 0
        ? vehicle.special_price
        : vehicle.retail_price;
    const days = daysInStock(vehicle.created_at);

    return (
        <>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { margin: 0; background: white !important; }
                    .sticker { box-shadow: none !important; border: 2px solid #111 !important; page-break-inside: avoid; }
                }
                @page { margin: 0.4in; size: letter; }
            `,
                }}
            />

            <div className="no-print flex items-center justify-center gap-3 border-b bg-white px-4 py-3 print:hidden">
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                >
                    <Printer className="h-4 w-4" />
                    Print window sticker
                </button>
                <button
                    type="button"
                    onClick={() => window.close()}
                    className="rounded-md border px-3 py-2 text-sm text-gray-700"
                >
                    Close
                </button>
            </div>

            <div className="mx-auto max-w-3xl p-6">
                <article className="sticker overflow-hidden rounded-lg border-2 border-gray-900 bg-white shadow-sm">
                    <header className="flex items-start justify-between gap-4 border-b-2 border-gray-900 bg-gray-50 px-5 py-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Window sticker
                            </p>
                            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                                {vehicle.trim ? ` ${vehicle.trim}` : ""}
                            </h1>
                            <p className="mt-1 font-mono text-sm text-gray-600">{vehicle.vin}</p>
                        </div>
                        <div className="text-right">
                            {vehicle.stock_number ? (
                                <p className="text-sm font-medium text-gray-700">
                                    Stock #{vehicle.stock_number}
                                </p>
                            ) : null}
                            <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
                                {money(price)}
                            </p>
                            <p className="text-xs text-gray-500">+ applicable taxes</p>
                        </div>
                    </header>

                    <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
                        <div className="border-b border-gray-200 bg-gray-100 sm:border-b-0 sm:border-r">
                            {photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={photo}
                                    alt=""
                                    className="h-full max-h-56 w-full object-cover sm:max-h-none sm:min-h-[220px]"
                                />
                            ) : (
                                <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-400">
                                    No photo
                                </div>
                            )}
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm">
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Condition</dt>
                                <dd className="font-medium">{vehicle.condition || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Odometer</dt>
                                <dd className="font-medium tabular-nums">
                                    {(vehicle.odometer || 0).toLocaleString()} km
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Exterior</dt>
                                <dd className="font-medium">{vehicle.exterior_color || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Interior</dt>
                                <dd className="font-medium">{vehicle.interior_color || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Fuel</dt>
                                <dd className="font-medium">{vehicle.fuel_type || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Transmission</dt>
                                <dd className="font-medium">{vehicle.transmission || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Drivetrain</dt>
                                <dd className="font-medium">{vehicle.drivetrain || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Body</dt>
                                <dd className="font-medium">{vehicle.body_style || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Status</dt>
                                <dd className="font-medium">{vehicle.status}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Days in stock</dt>
                                <dd className="font-medium tabular-nums">{days}</dd>
                            </div>
                        </dl>
                    </div>

                    <footer className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
                        Ask a salesperson for full history, options, and financing. Prices subject to
                        change. Printed {new Date().toLocaleDateString("en-CA")}.
                    </footer>
                </article>
            </div>
        </>
    );
}
