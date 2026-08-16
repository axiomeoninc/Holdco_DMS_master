"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    Images,
    Car,
    Loader2,
    Search,
    X,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Star,
    SlidersHorizontal,
} from "lucide-react";
import { resolveGallery, type VehicleImage as VehicleImageT } from "@/src/lib/vehicle-image";
import { apiFetch } from "@/src/lib/fetch";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface Vehicle {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    status: string;
    condition: string;
    retail_price: number;
    odometer: number;
    stock_number: string | null;
    image_gallery: string[];
    images?: string | string[] | null;
}

interface LightboxState {
    vehicle: Vehicle;
    images: VehicleImageT[];
    index: number;
}

const STATUS_OPTIONS = ["All", "Active", "Sold", "Inactive", "Coming Soon"];
const PHOTO_OPTIONS = [
    { id: "with", label: "With photos" },
    { id: "missing", label: "Missing photos" },
    { id: "all", label: "All units" },
] as const;
type PhotoFilter = (typeof PHOTO_OPTIONS)[number]["id"];

const ASPECTS = ["aspect-[4/3]", "aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[16/10]"];

export default function ImageLibraryPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [status, setStatus] = useState<string>("Active");
    const [makeFilter, setMakeFilter] = useState<string>("All");
    const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("with");
    const [search, setSearch] = useState<string>("");
    const [lightbox, setLightbox] = useState<LightboxState | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                setLoading(true);
                setError(null);
                // Pull all vehicles (max 200) — includes both Active and Sold.
                // NOTE: no `page` param — that would flip /api/vehicles into
                // new-style pagination (perPage defaults to 50) and cap the fetch.
                const res = await apiFetch<{ data: Vehicle[] }>("/api/vehicles?limit=200");
                if (cancelled) return;
                const all = res?.data ?? [];
                // Sort: Active first, then by image count desc, then year desc
                const sorted = [...all].sort((a, b) => {
                    const aCount = resolveGallery(a.image_gallery, a.images).length;
                    const bCount = resolveGallery(b.image_gallery, b.images).length;
                    if (a.status === "Active" && b.status !== "Active") return -1;
                    if (a.status !== "Active" && b.status === "Active") return 1;
                    if (bCount !== aCount) return bCount - aCount;
                    return b.year - a.year;
                });
                setVehicles(sorted);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load image library");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const makes = useMemo(() => {
        const m = new Set<string>();
        vehicles.forEach((v) => v.make && m.add(v.make));
        return ["All", ...Array.from(m).sort()];
    }, [vehicles]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return vehicles.filter((v) => {
            if (status !== "All" && v.status !== status) return false;
            if (makeFilter !== "All" && v.make !== makeFilter) return false;
            const imageCount = resolveGallery(v.image_gallery, v.images).length;
            if (photoFilter === "with" && imageCount === 0) return false;
            if (photoFilter === "missing" && imageCount > 0) return false;
            if (!q) return true;
            return (
                v.vin.toLowerCase().includes(q) ||
                (v.make + " " + v.model + " " + (v.trim ?? "")).toLowerCase().includes(q) ||
                String(v.stock_number ?? "").toLowerCase().includes(q)
            );
        });
    }, [vehicles, status, makeFilter, photoFilter, search]);

    const totalImages = useMemo(
        () => filtered.reduce((acc, v) => acc + resolveGallery(v.image_gallery, v.images).length, 0),
        [filtered]
    );

    const missingPhotoCount = useMemo(
        () =>
            vehicles.filter((v) => {
                if (status !== "All" && v.status !== status) return false;
                return resolveGallery(v.image_gallery, v.images).length === 0;
            }).length,
        [vehicles, status]
    );

    const openLightbox = (vehicle: Vehicle, images: VehicleImageT[], startIndex: number) => {
        setLightbox({ vehicle, images, index: startIndex });
    };

    const lightboxNav = useCallback(
        (dir: 1 | -1) => {
            setLightbox((lb) => {
                if (!lb || lb.images.length <= 1) return lb;
                return { ...lb, index: (lb.index + dir + lb.images.length) % lb.images.length };
            });
        },
        []
    );

    useOverlayDismiss(() => setLightbox(null), { open: !!lightbox });

    // Arrow-key navigation for the lightbox (Escape via useOverlayDismiss)
    useEffect(() => {
        if (!lightbox) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") lightboxNav(1);
            else if (e.key === "ArrowLeft") lightboxNav(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightbox, lightboxNav]);

    return (
        <div className="min-h-full p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <Images className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Image Library</h1>
                            <p className="text-sm text-muted-foreground">
                                {loading
                                    ? "Loading gallery…"
                                    : `${filtered.length} vehicles · ${totalImages} photos${
                                          missingPhotoCount > 0 && photoFilter !== "missing"
                                              ? ` · ${missingPhotoCount} missing photos`
                                              : ""
                                      }`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search VIN, make, model…"
                            className="pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-52 sm:w-64"
                        />
                    </div>
                    {/* Status filter */}
                    <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
                        {STATUS_OPTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    status === s
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    {/* Photo presence filter */}
                    <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1">
                        {PHOTO_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setPhotoFilter(opt.id)}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    photoFilter === opt.id
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                {opt.label}
                                {opt.id === "missing" && missingPhotoCount > 0
                                    ? ` (${missingPhotoCount})`
                                    : ""}
                            </button>
                        ))}
                    </div>
                    {/* Make filter */}
                    <select
                        value={makeFilter}
                        onChange={(e) => setMakeFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        aria-label="Filter by make"
                    >
                        {makes.map((m) => (
                            <option key={m} value={m}>{m === "All" ? "All makes" : m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <p className="text-sm text-muted-foreground">Loading image library…</p>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Car className="w-12 h-12 text-muted-foreground/40" />
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Images className="w-12 h-12 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                        {photoFilter === "missing"
                            ? "No vehicles are missing photos for these filters."
                            : "No vehicles match your filters."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {filtered.map((v) => {
                        const images = resolveGallery(v.image_gallery, v.images);
                        const cover = images.find((i) => i.is_cover) ?? images[0];
                        const aspect = ASPECTS[v.vin.length % ASPECTS.length];
                        const missing = images.length === 0;
                        return (
                            <div
                                key={v.vin}
                                className="group relative rounded-2xl overflow-hidden border border-border bg-background hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300"
                            >
                                {missing ? (
                                    <Link
                                        href={`/inventory/${encodeURIComponent(v.vin)}/edit`}
                                        className={`relative w-full ${aspect} overflow-hidden bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground`}
                                        aria-label={`Add photos for ${v.year} ${v.make} ${v.model}`}
                                    >
                                        <Images className="w-8 h-8 opacity-40" />
                                        <span className="text-xs font-medium">Add photos</span>
                                        <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-full backdrop-blur-sm ${
                                            v.status === "Active"
                                                ? "bg-emerald-500/90 text-white"
                                                : v.status === "Sold"
                                                    ? "bg-blue-600/90 text-white"
                                                    : "bg-gray-700/90 text-white"
                                        }`}>
                                            {v.status}
                                        </div>
                                    </Link>
                                ) : (
                                <button
                                    type="button"
                                    onClick={() => openLightbox(v, images, 0)}
                                    className={`relative w-full ${aspect} overflow-hidden bg-muted block cursor-zoom-in`}
                                    aria-label={`View ${v.year} ${v.make} ${v.model} photos`}
                                >
                                    <Image
                                        src={cover!.url}
                                        alt={`${v.year} ${v.make} ${v.model}`}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        onError={(e) => {
                                            // Skip broken images gracefully — the tile becomes a silent placeholder
                                            (e.currentTarget as HTMLImageElement).style.display = "none";
                                        }}
                                    />
                                    {/* Image count badge */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium rounded-full">
                                        <Images className="w-3 h-3" />
                                        <span>{images.length}</span>
                                    </div>
                                    {cover?.is_cover && (
                                        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-semibold text-white">
                                            <Star className="h-2.5 w-2.5 fill-current" />
                                            Cover
                                        </div>
                                    )}
                                    {/* Status pill */}
                                    <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-full backdrop-blur-sm ${
                                        v.status === "Active"
                                            ? "bg-emerald-500/90 text-white"
                                            : v.status === "Sold"
                                                ? "bg-blue-600/90 text-white"
                                                : "bg-gray-700/90 text-white"
                                    }`}>
                                        {v.status}
                                    </div>
                                    {/* Hover overlay → details */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                                        <p className="text-white text-sm font-semibold leading-tight">
                                            {v.year} {v.make} {v.model}
                                        </p>
                                        {v.trim && <p className="text-white/70 text-xs truncate mt-0.5">{v.trim}</p>}
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-white/90 text-xs font-medium">
                                                {v.retail_price > 0
                                                    ? `$${v.retail_price.toLocaleString()} + taxes`
                                                    : "Price on request"}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-white/80 text-[11px]">
                                                Details <ExternalLink className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </div>
                                </button>
                                )}
                                {/* Card footer */}
                                <div className="flex items-center justify-between px-3 py-2.5">
                                    <Link
                                        href={`/inventory/${encodeURIComponent(v.vin)}`}
                                        className="text-xs font-medium text-foreground hover:text-indigo-600 transition-colors truncate"
                                        title={`${v.year} ${v.make} ${v.model}`}
                                    >
                                        {v.year} {v.make} {v.model}
                                    </Link>
                                    <span className="text-[10px] text-muted-foreground font-mono truncate ml-2">
                                        {v.stock_number ? `#${v.stock_number}` : ""}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex flex-col"
                    onClick={() => setLightbox(null)}
                >
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
                        <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">
                                {lightbox.vehicle.year} {lightbox.vehicle.make} {lightbox.vehicle.model}
                            </p>
                            <p className="text-white/50 text-xs font-mono truncate">{lightbox.vehicle.vin}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-white/70 text-xs px-2 py-1 bg-white/10 rounded-full">
                                {lightbox.index + 1} / {lightbox.images.length}
                            </span>
                            <Link
                                href={`/inventory/${encodeURIComponent(lightbox.vehicle.vin)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                aria-label="Open vehicle details"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightbox(null);
                                }}
                                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                aria-label="Close lightbox"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Image stage */}
                    <div className="flex-1 relative flex items-center justify-center min-h-0">
                        {lightbox.images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); lightboxNav(-1); }}
                                    className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition-colors"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); lightboxNav(1); }}
                                    className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition-colors"
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </>
                        )}
                        <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
                            <Image
                                key={lightbox.images[lightbox.index].url}
                                src={lightbox.images[lightbox.index].url}
                                alt={`${lightbox.vehicle.year} ${lightbox.vehicle.make} ${lightbox.vehicle.model} photo ${lightbox.index + 1}`}
                                fill
                                sizes="100vw"
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>

                    {/* Thumbnail strip */}
                    {lightbox.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto px-4 py-3 bg-black/60 backdrop-blur-sm border-t border-white/10">
                            {lightbox.images.map((img, idx) => (
                                <button
                                    key={img.url + idx}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLightbox({ ...lightbox, index: idx });
                                    }}
                                    className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                        idx === lightbox.index
                                            ? "border-white ring-2 ring-white/40"
                                            : "border-transparent opacity-60 hover:opacity-100"
                                    }`}
                                    aria-label={`Show photo ${idx + 1}`}
                                >
                                    <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
                                    {img.is_cover && (
                                        <div className="absolute top-0.5 right-0.5 p-0.5 bg-amber-500 rounded">
                                            <Star className="w-2 h-2 fill-white text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
