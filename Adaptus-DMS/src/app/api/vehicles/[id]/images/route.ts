// app/api/vehicles/[id]/images/route.ts
// Per-vehicle image management (param is VIN; folder named [id] to share
// the same dynamic slug as /api/vehicles/[id] — Next.js forbids sibling
// dynamic segments with different names at the same path depth):
//   POST   /api/vehicles/:vin/images  — upload one or more images (multipart or base64),
//                                        appends public URLs to the vehicle's image_gallery
//   DELETE /api/vehicles/:vin/images  — remove a URL from image_gallery
//
// Auth: any signed-in user from the vehicle's dealership (or platform_admin).
// Uses supabaseAdmin for storage + DB writes to bypass RLS — the previous
// client-side `supabaseBrowser.storage.upload()` was silently failing with
// "new row violates row-level security policy" because the user role doesn't
// have INSERT on storage.objects.
import { getCurrentUser } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { parseGallery, serializeGallery, type VehicleImage } from "@/src/lib/vehicle-image";
import {
    findVehicleByVinOrId,
    VIN_LOOKUP_NEEDS_ACT_AS,
    VIN_LOOKUP_NO_CONTEXT,
} from "@/src/lib/vehicle-lookup";
import { readExplicitDealershipId } from "@/src/lib/platform-rooftop";
import { vehicleStorageFolder } from "@/src/lib/vehicle-storage";

const BUCKET = "vehicles";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per file

interface ImageUpload {
    filename?: string;
    base64?: string;
    contentType?: string;
}

interface AuthedUser {
    id: string;
    role: string;
    dealership_id: string | null;
    is_platform_admin: boolean;
}

async function getAuthedUser(req: NextRequest): Promise<AuthedUser | null> {
    const { user, profile } = await getCurrentUser(req);
    if (!user || !profile) return null;
    return {
        id: profile.id,
        role: profile.role,
        dealership_id: profile.dealership_id,
        is_platform_admin: profile.is_platform_admin,
    };
}

function rooftopForLookup(me: AuthedUser, req: NextRequest): string | null {
    if (me.is_platform_admin) {
        return readExplicitDealershipId(req) ?? me.dealership_id;
    }
    return me.dealership_id;
}

async function loadVehicleForImages(req: NextRequest, me: AuthedUser, rawKey: string) {
    const found = await findVehicleByVinOrId<{
        id: string;
        vin: string;
        image_gallery: unknown;
        dealership_id: string | null;
    }>(supabaseAdmin, rawKey, {
        dealershipId: rooftopForLookup(me, req),
        isPlatformAdmin: me.is_platform_admin,
        select: "id, vin, image_gallery, dealership_id",
    });
    if (found.ambiguous) {
        return {
            error: NextResponse.json(
                { error: "VIN matches multiple rooftops; select a dealership" },
                { status: 409 }
            ),
        };
    }
    if (found.error === VIN_LOOKUP_NEEDS_ACT_AS) {
        return { error: NextResponse.json({ error: found.error }, { status: 400 }) };
    }
    if (found.error === VIN_LOOKUP_NO_CONTEXT) {
        return { error: NextResponse.json({ error: found.error }, { status: 403 }) };
    }
    if (found.error) {
        return { error: NextResponse.json({ error: found.error }, { status: 500 }) };
    }
    if (!found.vehicle) {
        return { error: NextResponse.json({ error: `Vehicle not found: ${rawKey}` }, { status: 404 }) };
    }
    if (!me.is_platform_admin && found.vehicle.dealership_id !== me.dealership_id) {
        return { error: NextResponse.json({ error: "Vehicle belongs to another dealership" }, { status: 403 }) };
    }
    return { vehicle: found.vehicle };
}

function extFromMime(mime: string): string {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    if (mime === "image/gif") return "gif";
    return "jpg";
}

// POST — accepts either multipart/form-data (file field) OR application/json { filename, base64 }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const me = await getAuthedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Param folder is [id] for slug consistency; value is the vehicle VIN.
    const { id: rawVin } = await params;
    const vin = decodeURIComponent(rawVin);

    const loaded = await loadVehicleForImages(req, me, vin);
    if ("error" in loaded) return loaded.error;
    const vehicle = loaded.vehicle;

    // Read existing gallery (so we can dedupe + preserve order)
    const existing: string[] = Array.isArray(vehicle.image_gallery) ? vehicle.image_gallery : [];
    const existingParsed: VehicleImage[] = parseGallery(existing);
    const existingUrls = new Set(existingParsed.map((g) => g.url));

    // Two ingest paths: multipart (preferred for files) or JSON { filename, base64 }
    const contentType = req.headers.get("content-type") || "";
    const candidates: { name: string; mime: string; bytes: Uint8Array }[] = [];

    if (contentType.startsWith("multipart/form-data")) {
        let form: FormData;
        try {
            form = await req.formData();
        } catch (e) {
            return NextResponse.json({ error: `Invalid multipart body: ${(e as Error).message}` }, { status: 400 });
        }
        for (const [key, val] of form.entries()) {
            if (key !== "file" && key !== "files") continue;
            if (typeof val === "string") continue; // File entry only
            if (val.size > MAX_BYTES) {
                return NextResponse.json({ error: `File "${val.name}" exceeds 5MB limit` }, { status: 413 });
            }
            if (val.type && !ALLOWED_TYPES.includes(val.type)) {
                return NextResponse.json({ error: `Unsupported file type: ${val.type}` }, { status: 415 });
            }
            const bytes = new Uint8Array(await val.arrayBuffer());
            candidates.push({ name: val.name || "upload", mime: val.type || "image/jpeg", bytes });
        }
    } else {
        let body: { images?: ImageUpload[]; image?: ImageUpload } | null = null;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: `Invalid JSON body: ${(e as Error).message}` }, { status: 400 });
        }
        const incoming: ImageUpload[] = Array.isArray(body?.images) ? body.images : body?.image ? [body.image] : [];
        if (incoming.length === 0) {
            return NextResponse.json({ error: "No images provided (use multipart 'file' field or JSON {filename, base64})" }, { status: 400 });
        }
        for (const img of incoming) {
            if (!img?.base64) {
                return NextResponse.json({ error: "Each image requires {filename, base64}" }, { status: 400 });
            }
            const buf = Buffer.from(img.base64, "base64");
            if (buf.length > MAX_BYTES) {
                return NextResponse.json({ error: `File "${img.filename}" exceeds 5MB limit` }, { status: 413 });
            }
            const mime = img.contentType || "image/jpeg";
            if (!ALLOWED_TYPES.includes(mime)) {
                return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 415 });
            }
            candidates.push({ name: img.filename || "upload", mime, bytes: buf });
        }
    }

    if (candidates.length === 0) {
        return NextResponse.json({ error: "No files received" }, { status: 400 });
    }

    // Upload each file via supabaseAdmin (bypasses RLS) — add a timestamp prefix
    // to avoid collisions when two clients upload the same filename.
    const uploaded: { url: string; name: string }[] = [];
    const failed: { name: string; error: string }[] = [];
    const ts = Date.now();
    let folder: string;
    try {
        folder = vehicleStorageFolder(vehicle.dealership_id, vehicle.vin);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Storage path requires dealership_id" },
            { status: 400 }
        );
    }
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const safeName = c.name.replace(/[^\w.\-]/g, "_");
        const storagePath = `${folder}/${ts}-${i}-${safeName}`;
        const { error: upErr } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(storagePath, c.bytes, {
                contentType: c.mime,
                upsert: true,
            });
        if (upErr) {
            failed.push({ name: c.name, error: upErr.message });
            continue;
        }
        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
        uploaded.push({ url: pub.publicUrl, name: c.name });
    }

    if (uploaded.length === 0) {
        return NextResponse.json({ error: "All uploads failed", failed }, { status: 500 });
    }

    // Build new gallery: keep existing order, append new unique URLs.
    // For the first new image of an empty gallery, mark it as the cover.
    const newEntries: VehicleImage[] = [...existingParsed];
    for (const u of uploaded) {
        if (existingUrls.has(u.url)) continue;
        newEntries.push({
            url: u.url,
            role: null,
            is_cover: newEntries.length === 0, // first image = cover
            sort_order: newEntries.length,
        });
    }
    const newGallerySerialized = serializeGallery(newEntries);

    const { data: updated, error: updErr } = await supabaseAdmin
        .from("vehicles")
        .update({ image_gallery: newGallerySerialized })
        .eq("id", vehicle.id)
        .select("id, vin, image_gallery")
        .single();
    if (updErr) {
        return NextResponse.json({ error: `DB update failed: ${updErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        vin,
        uploaded: uploaded.length,
        failed,
        added_urls: uploaded.map((u) => u.url),
        image_gallery: updated?.image_gallery,
    });
}

// DELETE — body: { url: string }. Removes the URL from the vehicle's image_gallery.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const me = await getAuthedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Param folder is [id] for slug consistency; value is the vehicle VIN.
    const { id: rawVin } = await params;
    const vin = decodeURIComponent(rawVin);
    let body: { url?: string } | null = null;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const urlToRemove = body?.url;
    if (!urlToRemove || typeof urlToRemove !== "string") {
        return NextResponse.json({ error: "Body must include { url: string }" }, { status: 400 });
    }

    const loaded = await loadVehicleForImages(req, me, vin);
    if ("error" in loaded) return loaded.error;
    const vehicle = loaded.vehicle;

    // Gallery may be plain URL strings OR JSON-encoded VehicleImage objects.
    // Match by parsed URL — never compare raw text[] entries to the public URL.
    const existingParsed = parseGallery(vehicle.image_gallery);
    const filtered = existingParsed.filter((img) => img.url !== urlToRemove);

    if (filtered.length === existingParsed.length) {
        return NextResponse.json({
            ok: true,
            vin,
            removed: 0,
            image_gallery: vehicle.image_gallery,
        });
    }

    const normalized = filtered.map((img, i) => ({
        ...img,
        sort_order: i,
        is_cover: i === 0,
    }));
    const serialized = serializeGallery(normalized);

    const { data: updated, error: updErr } = await supabaseAdmin
        .from("vehicles")
        .update({ image_gallery: serialized })
        .eq("id", vehicle.id)
        .select("id, vin, image_gallery")
        .single();
    if (updErr) {
        return NextResponse.json({ error: `DB update failed: ${updErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        vin,
        removed: 1,
        image_gallery: updated?.image_gallery,
    });
}
