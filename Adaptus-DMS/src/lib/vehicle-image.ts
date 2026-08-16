/**
 * Image gallery data adapter.
 *
 * DB stores image_gallery as a `text[]` of JSON-encoded objects:
 *   '{"url":"...","role":"exterior","is_cover":true,"sort_order":0}'
 *
 * During the Hillz->Adaptus migration we placed the column as text[] because
 * we did not have a DDL connection. This module normalizes both shapes
 * (legacy plain URL strings and the new rich objects) so the rest of the
 * app can always work with VehicleImage[].
 *
 * TODO: promote column to jsonb via ALTER TABLE when DB access is available.
 */

export type VehicleImageRole =
    | "exterior"
    | "interior"
    | "odometer"
    | "wheels"
    | "damage"
    | "other";

export interface VehicleImage {
    url: string;
    role: VehicleImageRole | null;
    is_cover: boolean;
    sort_order: number;
}

function isRichObject(v: unknown): v is VehicleImage {
    return (
        typeof v === "object" &&
        v !== null &&
        typeof (v as VehicleImage).url === "string"
    );
}

/**
 * Normalize the raw image_gallery value from the API into VehicleImage[].
 * Handles: rich objects, JSON-stringified rich objects, and legacy URL strings.
 */
export function parseGallery(raw: unknown): VehicleImage[] {
    let list: unknown = raw;
    // Some drivers/serializers return text[] as a JSON array string.
    if (typeof list === "string") {
        const trimmed = list.trim();
        if (!trimmed) return [];
        try {
            list = JSON.parse(trimmed);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(list)) return [];
    const out: VehicleImage[] = [];
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (typeof entry === "string") {
            // Try to parse as JSON first
            try {
                const parsed = JSON.parse(entry);
                if (isRichObject(parsed)) {
                    out.push({
                        url: parsed.url,
                        role: parsed.role ?? null,
                        is_cover: parsed.is_cover ?? i === 0,
                        sort_order: typeof parsed.sort_order === "number" ? parsed.sort_order : i,
                    });
                    continue;
                }
            } catch {
                // not JSON, treat as legacy URL string
            }
            // Legacy plain URL
            out.push({
                url: entry,
                role: null,
                is_cover: i === 0,
                sort_order: i,
            });
        } else if (isRichObject(entry)) {
            out.push({
                url: entry.url,
                role: entry.role ?? null,
                is_cover: entry.is_cover ?? i === 0,
                sort_order: typeof entry.sort_order === "number" ? entry.sort_order : i,
            });
        }
    }
    // Sort by sort_order so callers always see gallery in display order
    out.sort((a, b) => a.sort_order - b.sort_order);
    return out;
}

/**
 * Serialize VehicleImage[] back to the DB shape (array of JSON strings
 * inside a text[] column).
 */
export function serializeGallery(images: VehicleImage[]): string[] {
    return images.map((img, i) =>
        JSON.stringify({
            url: img.url,
            role: img.role ?? null,
            is_cover: img.is_cover ?? i === 0,
            sort_order: typeof img.sort_order === "number" ? img.sort_order : i,
        })
    );
}

/** Pick the cover image, falling back to the first, then null. */
export function pickCover(images: VehicleImage[]): VehicleImage | null {
    if (!images.length) return null;
    const cover = images.find((i) => i.is_cover);
    return cover ?? images[0];
}

/** Pick the first image, regardless of cover flag. */
export function pickFirst(images: VehicleImage[]): VehicleImage | null {
    return images[0] ?? null;
}

/**
 * Convenience: given the RAW image_gallery value from the API (string[] of
 * rich JSON objects, plain URL strings, or undefined), return the display URL
 * (cover first, else first) or null when there is no usable image.
 *
 * Use this wherever the UI just needs a single thumbnail URL without having
 * to call parseGallery + pickCover itself. NEVER index raw gallery[0] — a
 * legacy plain URL is a string, but a rich entry is a JSON string that must
 * be parsed first.
 */
export function firstImageUrl(raw: unknown): string | null {
    const cover = pickCover(parseGallery(raw));
    return cover?.url ?? null;
}

/**
 * Prefer image_gallery; when it is empty or clearly short vs legacy `images`,
 * merge unique URLs from the legacy column so list/detail UIs show full sets.
 */
export function resolveGallery(
    imageGallery: unknown,
    legacyImages: unknown,
    shortThreshold = 2
): VehicleImage[] {
    const gallery = parseGallery(imageGallery);
    const legacyRaw = normalizeLegacyImages(legacyImages);
    const legacy = parseGallery(legacyRaw);

    if (legacy.length === 0) return gallery;
    if (gallery.length === 0) return legacy;
    if (gallery.length >= shortThreshold && gallery.length >= legacy.length) {
        return gallery;
    }

    const seen = new Set(gallery.map((img) => img.url));
    const merged = [...gallery];
    for (const img of legacy) {
        if (!seen.has(img.url)) {
            seen.add(img.url);
            merged.push({
                ...img,
                is_cover: false,
                sort_order: merged.length,
            });
        }
    }
    return merged;
}

function normalizeLegacyImages(legacyImages: unknown): unknown {
    if (legacyImages == null) return [];
    if (Array.isArray(legacyImages)) return legacyImages;
    if (typeof legacyImages === "string") {
        const trimmed = legacyImages.trim();
        if (!trimmed) return [];
        try {
            const parsed: unknown = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [trimmed];
        } catch {
            return [trimmed];
        }
    }
    return [];
}

export const IMAGE_ROLES: { value: VehicleImageRole; label: string; emoji: string }[] = [
    { value: "exterior", label: "Exterior", emoji: "🚗" },
    { value: "interior", label: "Interior", emoji: "🪑" },
    { value: "odometer", label: "Odometer", emoji: "📊" },
    { value: "wheels", label: "Wheels / Tires", emoji: "⚙️" },
    { value: "damage", label: "Damage / Notes", emoji: "⚠️" },
    { value: "other", label: "Other", emoji: "📷" },
];
