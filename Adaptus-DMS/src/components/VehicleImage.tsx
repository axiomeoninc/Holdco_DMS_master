"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Car, ImageIcon, Images } from "lucide-react";
import type { VehicleImage as VehicleImageT } from "@/src/lib/vehicle-image";

export type VehicleImageVariant = "card" | "thumb" | "hero" | "avatar";

interface VehicleImageProps {
    /** Full gallery (preferred). Component will pick the cover. */
    gallery?: VehicleImageT[];
    /** Or pass a single URL directly (e.g. legacy callers). */
    src?: string | null;
    /** Alt text fallback. */
    alt: string;
    variant: VehicleImageVariant;
    /** Optional className passthrough. */
    className?: string;
    /** Show "1 / 12" overlay on card variant. */
    showCount?: boolean;
    /** Override sizes for next/image responsive. */
    sizes?: string;
    /** When true, mark the first image as loading="eager" with high fetchpriority. */
    priority?: boolean;
}

const VARIANT_DIMENSIONS: Record<
    VehicleImageVariant,
    { width: number; height: number; sizes: string; sizesAttr: string }
> = {
    card: {
        width: 400,
        height: 300,
        sizes: "(max-width: 640px) 25vw, 120px",
        sizesAttr: "(max-width: 640px) 96px, 120px"
    },
    thumb: {
        width: 96,
        height: 96,
        sizes: "96px",
        sizesAttr: "96px"
    },
    avatar: {
        width: 64,
        height: 64,
        sizes: "64px",
        sizesAttr: "64px"
    },
    hero: {
        width: 1200,
        height: 800,
        sizes: "(max-width: 1024px) 100vw, 800px",
        sizesAttr: "(max-width: 1024px) 100vw, 800px"
    }
};

function CarSilhouette({ className = "w-12 h-12" }: { className?: string }) {
    return (
        <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${className}`}>
            <Car className="w-1/2 h-1/2 text-gray-400" />
        </div>
    );
}

/**
 * Shared vehicle image component. One source of truth for how a vehicle
 * image looks in this app. Variants:
 *   - card: 4:3, used in inventory list
 *   - thumb: 1:1, used in compact lists, badges
 *   - avatar: 1:1 small, used in linked records (leads/deals)
 *   - hero: 3:2 large, used in detail view
 *
 * Falls back to a car silhouette when the URL is missing or fails to load.
 * Shows a skeleton shimmer while loading.
 */
export default function VehicleImage({
    gallery,
    src,
    alt,
    variant,
    className = "",
    showCount = false,
    sizes,
    priority = false
}: VehicleImageProps) {
    // Resolve the URL
    const resolved =
        src ??
        (gallery && gallery.length > 0
            ? (gallery.find((g) => g.is_cover) ?? gallery[0]).url
            : null);

    const dim = VARIANT_DIMENSIONS[variant];
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Reset loading state when src changes
    useEffect(() => {
        setIsLoading(true);
        setHasError(false);
    }, [resolved]);

    if (!resolved || hasError) {
        return (
            <div
                className={`relative overflow-hidden bg-gray-100 ${
                    variant === "card" || variant === "hero" ? "aspect-[4/3]" : "aspect-square"
                } ${className}`}
                style={{
                    width: variant === "hero" ? "100%" : `${dim.width}px`,
                    height: variant === "hero" ? "auto" : `${dim.height}px`
                }}
            >
                <CarSilhouette
                    className={`w-full h-full ${
                        variant === "card" || variant === "hero" ? "" : "rounded-lg"
                    }`}
                />
            </div>
        );
    }

    const count = gallery?.length ?? 1;

    return (
        <div
            className={`relative overflow-hidden bg-gray-100 ${
                variant === "card" || variant === "hero" ? "aspect-[4/3]" : "aspect-square"
            } ${className}`}
        >
            {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
            )}
            <Image
                src={resolved}
                alt={alt}
                fill
                sizes={sizes ?? dim.sizesAttr}
                className={`object-cover transition-opacity duration-300 ${
                    isLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                }}
                priority={priority}
                quality={75}
            />

            {/* Multi-image indicator (card variant) */}
            {showCount && count > 1 && !isLoading && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium rounded-md">
                    <Images className="w-3 h-3" />
                    <span>{count}</span>
                </div>
            )}

            {/* Hero variant badge */}
            {variant === "hero" && count > 1 && !isLoading && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>1 / {count}</span>
                </div>
            )}
        </div>
    );
}
