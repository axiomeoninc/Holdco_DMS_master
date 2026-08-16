import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    AUCTION_SOURCE_FIELDS,
    normalizeAuctionLotInfo,
} from "@/src/lib/auction";
import { findVehicleByVinOrId, VIN_LOOKUP_NO_CONTEXT } from "@/src/lib/vehicle-lookup";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.is_platform_admin
            ? (new URL(req.url).searchParams.get("dealership_id") || auth.profile.dealership_id)
            : auth.profile.dealership_id;

        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const url = new URL(req.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const q = url.searchParams.get("q");

        let query = supabaseAdmin
            .from("purchase_from_public")
            .select(
                `
                *,
                vehicle:vehicles(id, vin, year, make, model, stock_number, status, purchase_price)
            `,
                { count: "exact" }
            )
            .eq("dealership_id", dealershipId)
            .order("purchase_date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (q) {
            // Strip PostgREST filter metacharacters so user search can't break `.or()`.
            const safe = q.replace(/[%*,()]/g, "").trim();
            if (safe) {
                query = query.or(
                    `seller_name.ilike.%${safe}%,seller_phone.ilike.%${safe}%,title_number.ilike.%${safe}%,notes.ilike.%${safe}%`
                );
            }
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({ data: data || [], count: count || 0, limit, offset });
    } catch (error: unknown) {
        console.error("Error fetching purchases:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json();
        const targetDealership =
            auth.profile.is_platform_admin && body.dealership_id
                ? body.dealership_id
                : dealershipId;

        if (!targetDealership) {
            return NextResponse.json({ error: "dealership_id required" }, { status: 400 });
        }

        if (!body.seller_name || typeof body.seller_name !== "string") {
            return NextResponse.json({ error: "seller_name is required" }, { status: 400 });
        }
        if (body.purchase_price === undefined || body.purchase_price === null || Number.isNaN(Number(body.purchase_price))) {
            return NextResponse.json({ error: "purchase_price is required" }, { status: 400 });
        }
        if (!body.purchase_date) {
            return NextResponse.json({ error: "purchase_date is required" }, { status: 400 });
        }

        let vehicleId: string | null = body.vehicle_id || null;

        // Optionally create a vehicle from public-purchase intake fields
        if (!vehicleId && body.create_vehicle && body.vehicle) {
            const v = body.vehicle as Record<string, unknown>;
            const vin = String(v.vin || "").trim().toUpperCase();
            if (!vin || vin.length < 11) {
                return NextResponse.json({ error: "Valid VIN required to create vehicle" }, { status: 400 });
            }
            if (!v.year || !v.make || !v.model) {
                return NextResponse.json(
                    { error: "year, make, and model are required to create vehicle" },
                    { status: 400 }
                );
            }

            const existingVin = await findVehicleByVinOrId<{ id: string }>(
                supabaseAdmin,
                vin,
                {
                    dealershipId: targetDealership,
                    select: "id",
                }
            );
            if (existingVin.error && existingVin.error !== VIN_LOOKUP_NO_CONTEXT) {
                return NextResponse.json({ error: existingVin.error }, { status: 500 });
            }
            if (existingVin.vehicle) {
                return NextResponse.json(
                    { error: "VIN already exists in this dealership's inventory" },
                    { status: 409 }
                );
            }

            const { data: newVehicle, error: vehicleError } = await supabaseAdmin
                .from("vehicles")
                .insert({
                    vin,
                    year: Number(v.year),
                    make: String(v.make).trim(),
                    model: String(v.model).trim(),
                    trim: v.trim ? String(v.trim) : null,
                    odometer: v.odometer != null ? Number(v.odometer) : 0,
                    condition: (v.condition as string) || "Used",
                    status: "Pending",
                    purchase_price: Number(body.purchase_price),
                    purchased_from: String(body.seller_name).trim(),
                    exterior_color: v.exterior_color ? String(v.exterior_color) : null,
                    stock_number: v.stock_number ? String(v.stock_number) : null,
                    dealership_id: targetDealership,
                    location_id:
                        typeof body.location_id === "string" && body.location_id.trim()
                            ? body.location_id.trim()
                            : null,
                    ...normalizeAuctionLotInfo(body),
                    internal_notes: body.notes
                        ? `Purchase from public: ${body.notes}`
                        : "Acquired via Purchase from Public",
                })
                .select("id")
                .single();

            if (vehicleError) {
                if ((vehicleError as { code?: string }).code === "23505") {
                    return NextResponse.json(
                        { error: "VIN already exists in inventory" },
                        { status: 409 }
                    );
                }
                throw vehicleError;
            }
            vehicleId = newVehicle.id;
        }

        const row: Record<string, unknown> = {
            dealership_id: targetDealership,
            vehicle_id: vehicleId,
            purchase_date: body.purchase_date,
            purchase_price: Number(body.purchase_price),
            seller_name: String(body.seller_name).trim(),
            seller_phone: body.seller_phone ? String(body.seller_phone).trim() : null,
            seller_address: body.seller_address ? String(body.seller_address).trim() : null,
            vin_verified: Boolean(body.vin_verified),
            title_received: Boolean(body.title_received),
            title_number: body.title_number ? String(body.title_number).trim() : null,
            notes: body.notes ? String(body.notes).trim() : null,
            location_id:
                typeof body.location_id === "string" && body.location_id.trim()
                    ? body.location_id.trim()
                    : null,
            ...normalizeAuctionLotInfo(body),
        };

        const { data, error } = await supabaseAdmin
            .from("purchase_from_public")
            .insert(row)
            .select(
                `
                *,
                vehicle:vehicles(id, vin, year, make, model, stock_number, status, purchase_price)
            `
            )
            .single();

        if (error) throw error;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating purchase:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

const PURCHASE_PATCH_FIELDS = [
    "purchase_date",
    "purchase_price",
    "seller_name",
    "seller_phone",
    "seller_address",
    "vin_verified",
    "title_received",
    "title_number",
    "notes",
    "location_id",
    ...AUCTION_SOURCE_FIELDS,
] as const;

export async function PATCH(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json();
        const id = typeof body.id === "string" ? body.id : null;
        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const { data: existing, error: loadErr } = await supabaseAdmin
            .from("purchase_from_public")
            .select("id, dealership_id")
            .eq("id", id)
            .maybeSingle();

        if (loadErr) throw loadErr;
        if (!existing) {
            return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
        }
        if (
            !auth.profile.is_platform_admin &&
            existing.dealership_id !== dealershipId
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const patch: Record<string, unknown> = {};
        for (const key of PURCHASE_PATCH_FIELDS) {
            if (body[key] === undefined) continue;
            if (key === "purchase_price") {
                const n = Number(body.purchase_price);
                if (Number.isNaN(n)) {
                    return NextResponse.json({ error: "purchase_price must be a number" }, { status: 400 });
                }
                patch.purchase_price = n;
            } else if (key === "vin_verified" || key === "title_received") {
                patch[key] = Boolean(body[key]);
            } else if (key === "seller_name") {
                const name = String(body.seller_name || "").trim();
                if (!name) {
                    return NextResponse.json({ error: "seller_name is required" }, { status: 400 });
                }
                patch.seller_name = name;
            } else if (
                key === "seller_phone" ||
                key === "seller_address" ||
                key === "title_number" ||
                key === "notes" ||
                key === "location_id" ||
                key === "auction_venue" ||
                key === "auction_lot_number" ||
                key === "auction_sale_date" ||
                key === "comp_notes"
            ) {
                const raw = body[key];
                patch[key] = raw == null || raw === "" ? null : String(raw).trim();
            } else {
                patch[key] = body[key];
            }
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("purchase_from_public")
            .update(patch)
            .eq("id", id)
            .select(
                `
                *,
                vehicle:vehicles(id, vin, year, make, model, stock_number, status, purchase_price)
            `
            )
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating purchase:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const url = new URL(req.url);
        let id = url.searchParams.get("id");
        if (!id) {
            try {
                const body = await req.json();
                if (typeof body?.id === "string") id = body.id;
            } catch {
                // no body
            }
        }
        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const { data: existing, error: loadErr } = await supabaseAdmin
            .from("purchase_from_public")
            .select("id, dealership_id")
            .eq("id", id)
            .maybeSingle();

        if (loadErr) throw loadErr;
        if (!existing) {
            return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
        }
        if (
            !auth.profile.is_platform_admin &&
            existing.dealership_id !== dealershipId
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from("purchase_from_public")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting purchase:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
