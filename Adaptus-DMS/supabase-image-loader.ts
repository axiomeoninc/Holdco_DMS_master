/**
 * Supabase Image Loader for Next.js
 *
 * Routes <Image> requests through Supabase Storage Image Transformation:
 *   /storage/v1/object/public/<bucket>/<path>  ->  /storage/v1/render/image/public/<bucket>/<path>?width=...&quality=...
 *
 * Why: free on-the-fly resize/format conversion via the Supabase CDN.
 *      Saves bandwidth, enables responsive srcSet, removes the need for
 *      pre-generated thumbnail variants.
 *
 * Free quota: 100 transformed images / month on Pro, $5 per 1k after.
 *
 * If a non-Supabase URL is passed (e.g. a Hillz CDN URL, or an external link),
 * it is returned as-is. Next.js will optimize it via its own loader if
 * `images.remotePatterns` allows the host.
 */
import type { ImageLoaderProps } from "next/image";

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zwfeitodxikdwymkieai.supabase.co";

const SUPABASE_HOST = (() => {
    try {
        return new URL(SUPABASE_URL).host;
    } catch {
        return "";
    }
})();

/**
 * Convert a Supabase Storage public URL to its transformed variant.
 *   https://<host>/storage/v1/object/public/<bucket>/<path>
 *   -> https://<host>/storage/v1/render/image/public/<bucket>/<path>?width=...&quality=...
 *
 * Returns null if the URL is not a Supabase storage URL.
 */
export function supabaseTransform(
    src: string,
    opts: { width?: number; quality?: number; resize?: "cover" | "contain" | "fill" } = {}
): string | null {
    if (!src) return null;
    try {
        const u = new URL(src);
        if (u.host !== SUPABASE_HOST) return null;
        // Match /storage/v1/object/public/<bucket>/<path...>
        const m = u.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
        if (!m) return null;
        const [, bucket, ...rest] = m;
        const path = rest.join("/");
        const newPath = `/storage/v1/render/image/public/${bucket}/${path}`;
        const params = new URLSearchParams();
        if (opts.width) params.set("width", String(opts.width));
        if (opts.quality) params.set("quality", String(opts.quality));
        if (opts.resize) params.set("resize", opts.resize);
        return `${u.protocol}//${u.host}${newPath}?${params.toString()}`;
    } catch {
        return null;
    }
}

/**
 * Next.js custom loader.
 *
 * Usage in next.config.ts:
 *   images: { loader: "custom", loaderFile: "./supabase-image-loader.ts" }
 */
export default function supabaseImageLoader({ src, width, quality }: ImageLoaderProps): string {
    const transformed = supabaseTransform(src, {
        width,
        quality: quality ?? 75,
        resize: "cover",
    });
    if (transformed) return transformed;
    // Fallback for non-Supabase URLs: Next.js will serve them through its
    // own optimizer (if remotePatterns allows) or as-is.
    return src;
}
