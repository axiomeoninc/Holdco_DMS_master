"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    ArrowLeft,
    Car,
    Image as ImageIcon,
    Trash2,
    Maximize2,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    Star,
    Images,
    CloudUpload,
    Loader2,
    AlertCircle,
    Pencil,
    Printer,
} from "lucide-react";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { CarfaxPanel } from "@/src/components/CarfaxPanel";
import { KijijiListingPack } from "@/src/components/KijijiListingPack";
import { RichTextDisplay } from "@/src/components/ui/rich-text-editor";
import { AiActionButton } from "@/src/components/ai/AiActionButton";
import { toast } from "@/src/lib/toast";
import {
    resolveGallery,
    serializeGallery,
    IMAGE_ROLES,
    type VehicleImage as VehicleImageT,
    type VehicleImageRole,
} from "@/src/lib/vehicle-image";
import { printWindowSticker } from "@/src/lib/window-sticker";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";
import { vehicleJsonLd, vehicleJsonLdHtml } from "@/src/lib/vehicle-jsonld";
import {
    disclosureDraftWarning,
    isActiveInventoryStatus,
    MVDA_ACTIVE_CLEAR_BLOCKED,
} from "@/src/lib/mvda-damage";

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
    purchase_price: number;
    retail_price: number;
    extra_costs: number;
    taxes: number;
    image_gallery: string[];
    images?: string | string[] | null;
    carfax_report_url?: string;
    engine?: string;
    body_style?: string;
    fuel_type?: string;
    transmission?: string;
    drivetrain?: string;
    exterior_color?: string;
    interior_color?: string;
    description?: string;
    features?: string[];
    purchased_from?: string | null;
    fuel_capacity?: string | null;
    city_fuel?: string | null;
    highway_fuel?: string | null;
    doors?: number | null;
    passengers?: number | null;
    msrp?: number | null;
    title_status?: string | null;
    special_price?: number | null;
    warranty?: string | null;
    disclosure?: string | null;
    known_damage?: boolean | null;
    internal_notes?: string | null;
    youtube_url?: string | null;
    inspection_report_url?: string | null;
    created_at: string;
    updated_at: string;
}

const STATUS_COLOR: Record<string, string> = {
    Active: "bg-success-50 text-success",
    Inactive: "bg-muted text-muted-foreground",
    Sold: "bg-foreground/90 text-background",
    "Coming Soon": "bg-warning-50 text-warning",
};

const CONDITION_COLOR: Record<string, string> = {
    New: "bg-success-50 text-success",
    Used: "bg-warning-50 text-warning",
    "Certified Pre-Owned": "bg-info-50 text-info",
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * InlineImageManager — add/remove, assign photo roles, and reorder gallery.
 * Upload/delete via /api/vehicles/[vin]/images; role/reorder via PATCH image_gallery.
 */
function InlineImageManager({
    vin,
    vehicleId,
    images,
    canEdit,
    onChange,
}: {
    vin: string;
    vehicleId: string;
    images: VehicleImageT[];
    canEdit: boolean;
    onChange: () => void | Promise<void>;
}) {
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const [savingMeta, setSavingMeta] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    async function persistGallery(next: VehicleImageT[]) {
        const normalized = serializeGallery(
            next.map((img, i) => ({
                ...img,
                sort_order: i,
                is_cover: i === 0,
            }))
        );
        setSavingMeta(true);
        setError(null);
        try {
            const res = await fetch(`/api/vehicles/${encodeURIComponent(vehicleId || vin)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ image_gallery: normalized }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `Save failed (${res.status})`);
            }
            await onChange();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update gallery");
            throw err;
        } finally {
            setSavingMeta(false);
        }
    }

    async function handleFiles(files: FileList | File[] | null) {
        if (!files || files.length === 0) return;
        const list = Array.from(files);
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        for (const f of list) {
            if (!allowed.includes(f.type)) {
                setError(`"${f.name}" is not a supported image type`);
                return;
            }
            if (f.size > 5 * 1024 * 1024) {
                setError(`"${f.name}" exceeds the 5MB limit`);
                return;
            }
        }
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            for (const f of list) form.append("file", f);
            const res = await fetch(`/api/vehicles/${encodeURIComponent(vin)}/images`, {
                method: "POST",
                body: form,
                credentials: "include",
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `Upload failed (${res.status})`);
            }
            const data = await res.json();
            const added = data.added_urls?.length || 0;
            toast.success(added === 1 ? "Image added" : `${added} images added`);
            await onChange();
        } catch (err) {
            console.error("Inline image upload failed:", err);
            setError(err instanceof Error ? err.message : "Failed to upload image");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleRemove(url: string) {
        setRemoving(url);
        setError(null);
        try {
            const res = await fetch(`/api/vehicles/${encodeURIComponent(vin)}/images`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ url }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `Delete failed (${res.status})`);
            }
            const body = await res.json().catch(() => ({}));
            if ((body as { removed?: number }).removed === 0) {
                // Fallback: rich gallery entries may have failed exact-match deletes on older servers
                const next = images.filter((img) => img.url !== url);
                await persistGallery(next);
            }
            toast.success("Image removed");
            await onChange();
        } catch (err) {
            console.error("Inline image remove failed:", err);
            setError(err instanceof Error ? err.message : "Failed to remove image");
        } finally {
            setRemoving(null);
        }
    }

    async function setRole(url: string, role: VehicleImageRole | "") {
        const next = images.map((img) =>
            img.url === url ? { ...img, role: role || null } : img
        );
        try {
            await persistGallery(next);
            toast.success("Photo role updated");
        } catch {
            /* error already set */
        }
    }

    async function move(index: number, dir: -1 | 1) {
        const target = index + dir;
        if (target < 0 || target >= images.length) return;
        const next = [...images];
        const tmp = next[index];
        next[index] = next[target];
        next[target] = tmp;
        try {
            await persistGallery(next);
        } catch {
            /* error already set */
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                            Manage Photos
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {images.length} photo{images.length === 1 ? "" : "s"} — assign roles and reorder. First photo is cover.
                            {savingMeta ? " Saving…" : ""}
                        </p>
                    </div>
                    <div>
                        {canEdit && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    className="hidden"
                                    id="inline-vehicle-image-upload"
                                    disabled={uploading}
                                    onChange={(e) => handleFiles(e.target.files)}
                                />
                                <label
                                    htmlFor="inline-vehicle-image-upload"
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        uploading
                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                            : "bg-foreground text-background hover:opacity-90 cursor-pointer"
                                    }`}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Uploading…
                                        </>
                                    ) : (
                                        <>
                                            <CloudUpload className="w-4 h-4" />
                                            Add Photos
                                        </>
                                    )}
                                </label>
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {images.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400">
                        <Images className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        No photos yet. Use &quot;Add Photos&quot; above to upload.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {images.map((img, idx) => (
                            <div
                                key={img.url}
                                className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                            >
                                <div className="relative aspect-square group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={img.url}
                                        alt={`Photo ${idx + 1}`}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                    {idx === 0 && (
                                        <div className="absolute top-1 left-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                            Cover
                                        </div>
                                    )}
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={() => void handleRemove(img.url)}
                                            disabled={removing === img.url}
                                            className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
                                            aria-label="Remove image"
                                        >
                                            {removing === img.url ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <X className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                    )}
                                </div>
                                {canEdit && (
                                    <div className="space-y-1.5 border-t border-gray-100 p-1.5">
                                        <select
                                            value={img.role || ""}
                                            onChange={(e) =>
                                                void setRole(
                                                    img.url,
                                                    e.target.value as VehicleImageRole | ""
                                                )
                                            }
                                            disabled={savingMeta}
                                            className="w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-800"
                                            aria-label={`Role for photo ${idx + 1}`}
                                        >
                                            <option value="">Uncategorized</option>
                                            {IMAGE_ROLES.map((r) => (
                                                <option key={r.value} value={r.value}>
                                                    {r.label}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                disabled={idx === 0 || savingMeta}
                                                onClick={() => void move(idx, -1)}
                                                className="inline-flex flex-1 items-center justify-center rounded border border-gray-200 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                                                aria-label="Move earlier"
                                            >
                                                <ChevronUp className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={idx >= images.length - 1 || savingMeta}
                                                onClick={() => void move(idx, 1)}
                                                className="inline-flex flex-1 items-center justify-center rounded border border-gray-200 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                                                aria-label="Move later"
                                            >
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VehicleDetailPage() {
    const params = useParams<{ vin: string }>();
    const router = useRouter();
    const vin = decodeURIComponent(params.vin);

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gallery, setGallery] = useState<VehicleImageT[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeRoleFilter, setActiveRoleFilter] = useState<VehicleImageRole | "all">("all");
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    // URLs that have failed to load — used to show a fallback instead of
    // the browser's broken-image icon (F-08 of v3 plan).
    const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
    const [disclosureDraft, setDisclosureDraft] = useState("");
    const [savingDisclosure, setSavingDisclosure] = useState(false);
    const [priceNarrative, setPriceNarrative] = useState("");

    const heroRef = useRef<HTMLDivElement>(null);
    const railRef = useRef<HTMLDivElement>(null);

    const canEdit =
        userRole === "Admin" ||
        userRole === "Manager" ||
        userPermissions.includes("vehicles:write") ||
        userPermissions.includes("vehicles:photos");
    const canDelete = userRole === "Admin" || userPermissions.includes("vehicles:delete");

    // Fetch the vehicle
    useEffect(() => {
        let cancelled = false;
        async function fetchVehicle() {
            try {
                setLoading(true);
                setError(null);
                // Look up by VIN (URL-friendly), but the API supports id; try by VIN first
                const res = await fetch(`/api/vehicles?vin=${encodeURIComponent(vin)}&limit=1`, {
                });
                if (!res.ok) throw new Error("Vehicle not found");
                const data = await res.json();
                if (cancelled) return;
                const v: Vehicle | undefined = data.data?.[0];
                if (!v) throw new Error("Vehicle not found");
                setVehicle(v);
                setDisclosureDraft(v.disclosure || "");
                setGallery(resolveGallery(v.image_gallery, v.images));
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Failed to load vehicle");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchVehicle();
        return () => {
            cancelled = true;
        };
    }, [vin]);

    // schema.org Vehicle JSON-LD so LLM-shoppers can parse this listing.
    useEffect(() => {
        if (!vehicle) return;
        const existing = document.getElementById("vehicle-jsonld");
        if (existing) existing.remove();
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "vehicle-jsonld";
        const maskedVin =
            vehicle.vin && vehicle.vin.length > 8
                ? `${vehicle.vin.slice(0, 4)}…${vehicle.vin.slice(-4)}`
                : vehicle.vin || null;
        script.textContent = vehicleJsonLdHtml(
            vehicleJsonLd(
                {
                    year: vehicle.year,
                    make: vehicle.make,
                    model: vehicle.model,
                    trim: vehicle.trim,
                    odometer: vehicle.odometer,
                    condition: vehicle.condition,
                    exterior_color: vehicle.exterior_color,
                    interior_color: vehicle.interior_color,
                    fuel_type: vehicle.fuel_type,
                    transmission: vehicle.transmission,
                    drivetrain: vehicle.drivetrain,
                    body_style: vehicle.body_style,
                    retail_price: vehicle.retail_price,
                    special_price: vehicle.special_price,
                    photos: gallery.map((g) => g.url),
                    description: vehicle.description,
                    features: vehicle.features,
                    vin_masked: maskedVin,
                    stock_number: vehicle.stock_number,
                },
                { priceCurrency: "CAD", url: `/inventory/${encodeURIComponent(vehicle.vin)}` }
            )
        );
        document.head.appendChild(script);
        return () => {
            script.remove();
        };
    }, [vehicle, gallery]);

    // Fetch user permissions
    useEffect(() => {
        async function fetchPerms() {
            try {
                const res = await fetch("/api/me", {
                });
                if (res.ok) {
                    const data = await res.json();
                    setUserPermissions(data.data?.user_permissions || []);
                    setUserRole(data.data?.role || "");
                }
            } catch {
                // ignore
            }
        }
        fetchPerms();
    }, []);

    // Filter gallery by role
    const filteredGallery = activeRoleFilter === "all"
        ? gallery
        : gallery.filter((g) => g.role === activeRoleFilter);

    // Whenever filter changes, snap to a valid index
    useEffect(() => {
        if (filteredGallery.length > 0 && currentIndex >= filteredGallery.length) {
            setCurrentIndex(0);
        }
    }, [filteredGallery.length, currentIndex]);

    const currentImage = filteredGallery[currentIndex];

    const goNext = useCallback(() => {
        if (filteredGallery.length === 0) return;
        setCurrentIndex((i) => (i + 1) % filteredGallery.length);
    }, [filteredGallery.length]);

    const goPrev = useCallback(() => {
        if (filteredGallery.length === 0) return;
        setCurrentIndex((i) => (i - 1 + filteredGallery.length) % filteredGallery.length);
    }, [filteredGallery.length]);

    // Keyboard nav (Escape for fullscreen via useOverlayDismiss)
    useOverlayDismiss(() => setIsFullscreen(false), { open: isFullscreen });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (showConfirmDelete) return;
            if (e.key === "ArrowRight") goNext();
            else if (e.key === "ArrowLeft") goPrev();
            else if (e.key === "f" || e.key === "F") setIsFullscreen((s) => !s);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [goNext, goPrev, showConfirmDelete]);

    // Scroll active thumb into view
    useEffect(() => {
        if (!railRef.current) return;
        const active = railRef.current.querySelector(`[data-thumb-idx="${currentIndex}"]`) as HTMLElement | null;
        if (active) {
            active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentIndex]);

    async function handleDelete() {
        if (!vehicle) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicle.id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete");
            router.push("/inventory");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete");
            setDeleting(false);
        }
    }

    async function saveDisclosure() {
        if (!vehicle || !canEdit) return;
        const warn = disclosureDraftWarning({
            status: vehicle.status,
            known_damage: vehicle.known_damage,
            disclosure: disclosureDraft,
        });
        if (
            isActiveInventoryStatus(vehicle.status) &&
            vehicle.known_damage &&
            !disclosureDraft.trim()
        ) {
            toast.error(warn || MVDA_ACTIVE_CLEAR_BLOCKED);
            return;
        }
        setSavingDisclosure(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicle.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disclosure: disclosureDraft.trim() || null }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(
                    (body as { error?: string }).error || "Failed to save disclosure"
                );
            }
            const json = await res.json();
            setVehicle((prev) =>
                prev
                    ? {
                          ...prev,
                          disclosure:
                              json.data?.disclosure ??
                              (disclosureDraft.trim() || null),
                      }
                    : prev
            );
            toast.success("Disclosure saved");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSavingDisclosure(false);
        }
    }

    // Group counts by role for the filter chips
    const roleCounts = gallery.reduce<Record<string, number>>((acc, g) => {
        const k = g.role ?? "uncategorized";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading vehicle…</p>
                </div>
            </div>
        );
    }

    if (error || !vehicle) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="text-center max-w-md">
                    <Car className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Vehicle not found</h2>
                    <p className="mb-5 text-sm text-muted-foreground">{error ?? "This vehicle may have been removed."}</p>
                    <Link
                        href="/inventory"
                        className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to inventory
                    </Link>
                </div>
            </div>
        );
    }

    const grossProfit = vehicle.retail_price - vehicle.purchase_price - vehicle.extra_costs - vehicle.taxes;

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky top bar */}
            <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link
                        href="/inventory"
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Inventory</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const ok = printWindowSticker(vehicle);
                                if (!ok) toast.error("Allow pop-ups to print the window sticker");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 min-h-10 text-sm font-medium text-foreground hover:bg-muted"
                            aria-label="Print window sticker"
                        >
                            <Printer className="h-4 w-4" />
                            <span className="hidden sm:inline">Sticker</span>
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (typeof window === "undefined") return;
                                const url = window.location.href;
                                const shareText = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

                                async function copyWithFallback(text: string) {
                                    if (navigator.clipboard?.writeText) {
                                        await navigator.clipboard.writeText(text);
                                        return;
                                    }
                                    const ta = document.createElement("textarea");
                                    ta.value = text;
                                    ta.setAttribute("readonly", "");
                                    ta.style.position = "fixed";
                                    ta.style.left = "-9999px";
                                    document.body.appendChild(ta);
                                    ta.select();
                                    const ok = document.execCommand("copy");
                                    document.body.removeChild(ta);
                                    if (!ok) throw new Error("Copy failed");
                                }

                                // Prefer clipboard + toast for reliable feedback.
                                // Use Web Share only when available; ignore user cancel.
                                if (
                                    typeof navigator.share === "function" &&
                                    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                                ) {
                                    try {
                                        await navigator.share({ title: shareText, url });
                                        toast.success("Shared");
                                        return;
                                    } catch (err) {
                                        if (
                                            err instanceof DOMException &&
                                            err.name === "AbortError"
                                        ) {
                                            return;
                                        }
                                        /* fall through to clipboard */
                                    }
                                }

                                try {
                                    await copyWithFallback(url);
                                    setCopied(true);
                                    toast.success("Link copied", shareText);
                                    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
                                    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
                                } catch {
                                    toast.error("Copy failed", "Could not copy link to clipboard");
                                }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 min-h-10 text-sm font-medium text-foreground hover:bg-muted"
                            aria-label="Copy share link"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
                        </button>
                        {canEdit && (
                            <Link
                                href={`/inventory/${encodeURIComponent(vehicle.vin)}/edit`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 min-h-10 text-sm font-medium text-foreground hover:bg-muted"
                            >
                                <Pencil className="h-4 w-4" />
                                <span className="hidden sm:inline">Edit</span>
                            </Link>
                        )}
                        {canDelete && (
                            <button
                                type="button"
                                onClick={() => setShowConfirmDelete(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-3 py-2 min-h-10 text-sm font-medium text-destructive hover:bg-destructive-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Delete</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
                {/* 1. Gallery hero */}
                <div className="space-y-4">
                    <div
                        ref={heroRef}
                        className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-muted sm:aspect-[2/1]"
                    >
                        {currentImage && !brokenImages.has(currentImage.url) ? (
                            <button
                                type="button"
                                className="absolute inset-0 cursor-zoom-in"
                                onClick={() => setIsFullscreen(true)}
                                aria-label="Open image lightbox"
                            >
                                <Image
                                    key={currentImage.url}
                                    src={currentImage.url}
                                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} - photo ${currentIndex + 1}`}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 1100px"
                                    priority={currentIndex === 0}
                                    quality={80}
                                    className="object-contain"
                                    onError={() => {
                                        setBrokenImages((prev) => new Set(prev).add(currentImage.url));
                                    }}
                                />
                            </button>
                        ) : brokenImages.has(currentImage?.url || "") ? (
                            <div className="flex h-full w-full items-center justify-center">
                                <div className="px-4 text-center">
                                    <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground/40" />
                                    <p className="text-sm text-muted-foreground">Image failed to load</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground/40" />
                                    <p className="text-sm text-muted-foreground">No images</p>
                                </div>
                            </div>
                        )}

                        {filteredGallery.length > 0 && (
                            <div className="absolute left-3 top-3 rounded-md bg-foreground/75 px-2 py-0.5 text-[11px] font-medium text-background tabular-nums">
                                {currentIndex + 1}/{filteredGallery.length}
                            </div>
                        )}

                        {currentImage?.is_cover && (
                            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-warning px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
                                <Star className="h-3 w-3 fill-current" />
                                Cover
                            </div>
                        )}

                        {currentImage && (
                            <button
                                type="button"
                                onClick={() => setIsFullscreen(true)}
                                className="absolute bottom-3 right-3 rounded-md bg-foreground/70 p-2 text-background opacity-0 transition-opacity hover:bg-foreground group-hover:opacity-100"
                                aria-label="Open fullscreen"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </button>
                        )}

                        {filteredGallery.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={goPrev}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/55 p-2 text-background hover:bg-foreground/80"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={goNext}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/55 p-2 text-background hover:bg-foreground/80"
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </>
                        )}
                    </div>

                    {gallery.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                            <button
                                type="button"
                                onClick={() => setActiveRoleFilter("all")}
                                className={`shrink-0 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                                    activeRoleFilter === "all"
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                All {gallery.length}
                            </button>
                            {IMAGE_ROLES.map((r) => {
                                const count = roleCounts[r.value] || 0;
                                if (count === 0) return null;
                                const active = activeRoleFilter === r.value;
                                return (
                                    <button
                                        key={r.value}
                                        type="button"
                                        onClick={() => setActiveRoleFilter(r.value)}
                                        className={`shrink-0 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {r.label} {count}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {filteredGallery.length > 1 && (
                        <div ref={railRef} className="flex gap-1.5 overflow-x-auto pb-1 snap-x snap-mandatory">
                            {filteredGallery.map((img, idx) => (
                                <button
                                    key={img.url + idx}
                                    type="button"
                                    data-thumb-idx={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    onDoubleClick={() => {
                                        setCurrentIndex(idx);
                                        setIsFullscreen(true);
                                    }}
                                    className={`relative h-14 w-14 shrink-0 snap-start overflow-hidden rounded-md border-2 transition-all sm:h-16 sm:w-16 ${
                                        idx === currentIndex
                                            ? "border-foreground ring-2 ring-foreground/20"
                                            : "border-transparent hover:border-border"
                                    }`}
                                    aria-label={`Show image ${idx + 1}${img.is_cover ? " (cover)" : ""}`}
                                >
                                    <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
                                    {img.is_cover && (
                                        <span className="absolute left-0.5 top-0.5 rounded bg-warning p-0.5 text-warning-foreground">
                                            <Star className="h-2.5 w-2.5 fill-current" />
                                        </span>
                                    )}
                                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 text-[9px] font-medium text-white tabular-nums">
                                        {idx + 1}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Identity */}
                <div className="border-b border-border pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                        </h1>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[vehicle.status] || "bg-muted text-muted-foreground"}`}>
                            {vehicle.status}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${CONDITION_COLOR[vehicle.condition] || "bg-muted text-muted-foreground"}`}>
                            {vehicle.condition}
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                        {vehicle.trim && <span>{vehicle.trim}</span>}
                        {vehicle.trim && <span aria-hidden>·</span>}
                        <span>Stock {vehicle.stock_number || "—"}</span>
                        <span aria-hidden>·</span>
                        <span className="font-mono text-xs">{vehicle.vin}</span>
                    </div>
                </div>

                {/* 3. Pricing + 4. Specs */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                    <section className="rounded-xl border border-border bg-card p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                            {formatCurrency(vehicle.retail_price)}
                        </p>
                        <p className="text-xs text-muted-foreground">Retail + taxes</p>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
                            <div>
                                <dt className="text-[11px] text-muted-foreground">Purchase</dt>
                                <dd className="font-medium tabular-nums text-foreground">{formatCurrency(vehicle.purchase_price)}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] text-muted-foreground">Gross profit</dt>
                                <dd className={`font-semibold tabular-nums ${grossProfit >= 0 ? "text-success" : "text-destructive"}`}>
                                    {formatCurrency(grossProfit)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] text-muted-foreground">Extra costs</dt>
                                <dd className="tabular-nums text-foreground/80">{formatCurrency(vehicle.extra_costs)}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] text-muted-foreground">Taxes</dt>
                                <dd className="tabular-nums text-foreground/80">{formatCurrency(vehicle.taxes)}</dd>
                            </div>
                        </dl>
                    </section>

                    <section className="rounded-xl border border-border bg-card p-4">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Specs
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                            <SpecRow
                                label="Odometer"
                                value={
                                    vehicle.odometer != null
                                        ? `${vehicle.odometer.toLocaleString()} km`
                                        : undefined
                                }
                            />
                            <SpecRow label="Engine" value={vehicle.engine} />
                            <SpecRow label="Transmission" value={vehicle.transmission} />
                            <SpecRow label="Drivetrain" value={vehicle.drivetrain} />
                            <SpecRow label="Fuel" value={vehicle.fuel_type} />
                            <SpecRow label="Body" value={vehicle.body_style} />
                            <SpecRow label="Ext. color" value={vehicle.exterior_color} />
                            <SpecRow label="Int. color" value={vehicle.interior_color} />
                            <SpecRow label="Stock" value={vehicle.stock_number} />
                            <SpecRow label="Fuel capacity" value={vehicle.fuel_capacity} />
                            <SpecRow label="City fuel" value={vehicle.city_fuel} />
                            <SpecRow label="Highway fuel" value={vehicle.highway_fuel} />
                            <SpecRow
                                label="Doors"
                                value={vehicle.doors != null ? String(vehicle.doors) : undefined}
                            />
                            <SpecRow
                                label="Passengers"
                                value={vehicle.passengers != null ? String(vehicle.passengers) : undefined}
                            />
                            <SpecRow
                                label="MSRP"
                                value={vehicle.msrp != null ? formatCurrency(vehicle.msrp) : undefined}
                            />
                            <SpecRow label="Purchased from" value={vehicle.purchased_from} />
                            <SpecRow label="Title status" value={vehicle.title_status} />
                            <SpecRow
                                label="Special price"
                                value={vehicle.special_price != null ? formatCurrency(vehicle.special_price) : undefined}
                            />
                        </div>
                    </section>
                </div>

                {/* 5. Features */}
                <section className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Features
                    </p>
                    {vehicle.features && vehicle.features.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                            {vehicle.features.map((feature) => (
                                <li
                                    key={feature}
                                    className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                                >
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                    )}
                </section>

                {/* 6. Description */}
                <section className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Description
                        </p>
                        {canEdit && vehicle.id ? (
                            <AiActionButton
                                label="Generate description"
                                endpoint="/api/ai/description"
                                body={{ vehicle_id: vehicle.id }}
                                onResult={(content) => {
                                    void (async () => {
                                        try {
                                            const res = await fetch(
                                                `/api/vehicles/${encodeURIComponent(vehicle.id)}`,
                                                {
                                                    method: "PATCH",
                                                    credentials: "include",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        description: content,
                                                    }),
                                                }
                                            );
                                            if (!res.ok) {
                                                const body = await res.json().catch(() => ({}));
                                                throw new Error(
                                                    (body as { error?: string }).error ||
                                                        "Failed to save description"
                                                );
                                            }
                                            setVehicle((v) =>
                                                v ? { ...v, description: content } : v
                                            );
                                            toast.success(
                                                "Description saved",
                                                "Review on edit if you need tweaks."
                                            );
                                        } catch (err) {
                                            toast.error(
                                                err instanceof Error
                                                    ? err.message
                                                    : "Could not save description"
                                            );
                                        }
                                    })();
                                }}
                            />
                        ) : null}
                    </div>
                    <RichTextDisplay value={vehicle.description} />
                    {canEdit && vehicle.id ? (
                        <div className="space-y-2 border-t border-border pt-3">
                            <AiActionButton
                                label="Price / aging narrative"
                                endpoint="/api/ai/price-narrative"
                                body={{ vehicle_id: vehicle.id }}
                                onResult={(content) => setPriceNarrative(content)}
                            />
                            {priceNarrative ? (
                                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-sans text-xs leading-relaxed text-foreground/90">
                                    {priceNarrative}
                                </pre>
                            ) : null}
                        </div>
                    ) : null}
                </section>

                <section className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Warranty / disclosure / notes
                    </p>
                    <div>
                        <p className="text-[11px] text-muted-foreground">Warranty</p>
                        <p className={`whitespace-pre-line text-sm ${vehicle.warranty?.trim() ? "text-foreground/85" : "text-muted-foreground"}`}>
                            {vehicle.warranty?.trim() ? vehicle.warranty : "—"}
                        </p>
                    </div>
                    <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">
                                Disclosure
                                {vehicle.known_damage ? (
                                    <span className="ml-1 text-amber-700">
                                        · known damage (MVDA)
                                    </span>
                                ) : null}
                            </p>
                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() => void saveDisclosure()}
                                    disabled={
                                        savingDisclosure ||
                                        disclosureDraft === (vehicle.disclosure || "")
                                    }
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
                                >
                                    {savingDisclosure ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : null}
                                    Save disclosure
                                </button>
                            )}
                        </div>
                        {canEdit ? (
                            <>
                                <div className="mb-2">
                                    <AiActionButton
                                        label="Ontario disclosure helper"
                                        endpoint="/api/ai/disclosure"
                                        body={{ vehicle_id: vehicle.id }}
                                        onResult={(content) => {
                                            setDisclosureDraft(content);
                                            toast.success(
                                                "Disclosure draft ready",
                                                "Human confirm — click Save disclosure."
                                            );
                                        }}
                                    />
                                </div>
                                <textarea
                                rows={3}
                                value={disclosureDraft}
                                onChange={(e) => setDisclosureDraft(e.target.value)}
                                placeholder="Ontario MVDA disclosure notes…"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            </>
                        ) : (
                            <p
                                className={`whitespace-pre-line text-sm ${
                                    vehicle.disclosure?.trim()
                                        ? "text-foreground/85"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {vehicle.disclosure?.trim()
                                    ? vehicle.disclosure
                                    : "—"}
                            </p>
                        )}
                    </div>
                    <div>
                        <p className="text-[11px] text-muted-foreground">Internal notes</p>
                        <RichTextDisplay value={vehicle.internal_notes} />
                    </div>
                    <div>
                        <p className="text-[11px] text-muted-foreground">YouTube</p>
                        {vehicle.youtube_url?.trim() ? (
                            <a
                                href={vehicle.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-info hover:underline break-all"
                            >
                                {vehicle.youtube_url}
                            </a>
                        ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                        )}
                    </div>
                    <div>
                        <p className="text-[11px] text-muted-foreground">Inspection report</p>
                        {vehicle.inspection_report_url?.trim() ? (
                            <a
                                href={vehicle.inspection_report_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-info hover:underline break-all"
                            >
                                View report
                            </a>
                        ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                        )}
                    </div>
                </section>

                {/* 7. Carfax — fetch/upload/attach */}
                <CarfaxPanel
                    vehicleId={vehicle.id}
                    vin={vehicle.vin}
                    carfaxReportUrl={vehicle.carfax_report_url}
                    canEdit={canEdit}
                    onAttached={(url) =>
                        setVehicle((prev) =>
                            prev ? { ...prev, carfax_report_url: url } : prev
                        )
                    }
                />

                {/* 8. Marketplace syndication (Kijiji pack + AutoTrader feed — no auto-post) */}
                <KijijiListingPack vehicleId={vehicle.id} vin={vehicle.vin} />
            </div>

            {/* Fullscreen lightbox */}
            {isFullscreen && currentImage && (
                <div
                    className="fixed inset-0 z-50 flex flex-col bg-black/95"
                    onClick={() => setIsFullscreen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image lightbox"
                >
                    <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                            </p>
                            <p className="truncate font-mono text-xs text-white/50">{vehicle.vin}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {currentImage.is_cover && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                                    <Star className="h-3 w-3 fill-current" />
                                    Cover
                                </span>
                            )}
                            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70 tabular-nums">
                                {currentIndex + 1} / {filteredGallery.length}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFullscreen(false);
                                }}
                                className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                                aria-label="Close lightbox"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="relative flex min-h-0 flex-1 items-center justify-center">
                        {filteredGallery.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/25 sm:left-6"
                                    aria-label="Previous"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/25 sm:right-6"
                                    aria-label="Next"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </>
                        )}
                        <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
                            <Image
                                key={currentImage.url}
                                src={currentImage.url}
                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} - photo ${currentIndex + 1}`}
                                fill
                                sizes="100vw"
                                className="object-contain"
                                quality={90}
                                priority
                            />
                        </div>
                    </div>

                    {filteredGallery.length > 1 && (
                        <div
                            className="flex gap-2 overflow-x-auto border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {filteredGallery.map((img, idx) => (
                                <button
                                    key={img.url + idx}
                                    type="button"
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                                        idx === currentIndex
                                            ? "border-white ring-2 ring-white/40"
                                            : "border-transparent opacity-60 hover:opacity-100"
                                    }`}
                                    aria-label={`Show photo ${idx + 1}`}
                                >
                                    <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
                                    {img.is_cover && (
                                        <span className="absolute right-0.5 top-0.5 rounded bg-amber-500 p-0.5">
                                            <Star className="h-2 w-2 fill-white text-white" />
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Inline image manager — bypasses the Edit modal so the user can add
                photos directly. Uses the same /api/vehicles/[vin]/images endpoint
                that fixes the broken client-side storage RLS issue. Always
                rendered (gallery is read-only for everyone; upload/remove are
                gated inside the component on the role/permission check). */}
            <InlineImageManager
                vin={vehicle.vin}
                vehicleId={vehicle.id}
                images={gallery}
                canEdit={canEdit}
                onChange={async () => {
                    // Re-fetch from /api/vehicles?vin=... to keep gallery in sync
                    try {
                        const res = await fetch(`/api/vehicles?vin=${encodeURIComponent(vehicle.vin)}&limit=1`, { credentials: "include" });
                        if (res.ok) {
                            const data = await res.json();
                            const updated = data?.data?.[0];
                            if (updated) {
                                setVehicle((v) => v ? {
                                    ...v,
                                    image_gallery: updated.image_gallery,
                                    images: updated.images ?? v.images,
                                } : v);
                                setGallery(resolveGallery(updated.image_gallery, updated.images));
                            }
                        }
                    } catch (_err) {
                        // fallback: full reload
                        window.location.reload();
                    }
                }}
            />

            {/* Modals */}
            {showConfirmDelete && (
                <ConfirmDialog
                    isOpen={showConfirmDelete}
                    title="Delete Vehicle"
                    message={`Are you sure you want to delete this vehicle?\n${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    confirmText="Delete"
                    variant="danger"
                    loading={deleting}
                    onConfirm={handleDelete}
                    onCancel={() => setShowConfirmDelete(false)}
                />
            )}
        </div>
    );
}

function SpecRow({ label, value }: { label: string; value?: string | null }) {
    const display = value != null && String(value).trim() !== "" ? String(value) : "—";
    const empty = display === "—";
    return (
        <div className="flex flex-col gap-1 py-2.5 border-b border-border/60 last:border-0">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span className={`text-sm font-medium ${empty ? "text-muted-foreground/50" : "text-foreground"}`}>
                {display}
            </span>
        </div>
    );
}
