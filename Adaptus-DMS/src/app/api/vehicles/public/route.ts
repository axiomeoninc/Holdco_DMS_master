// app/api/vehicles/public/route.ts
// Public Active inventory — MUST be dealership-scoped (id, slug, or embed token).
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import {
    buildPublicFacets,
    isDealershipEmbedBlocked,
    maskVinForPublic,
    parsePublicYear,
    publicVehicleQuerySpec,
    sanitizePublicExactFilter,
    sanitizePublicSearchQuery,
} from "@/src/lib/public-inventory";

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60, s-maxage=60",
};

function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type DealershipRow = {
    id: string;
    name: string;
    slug: string | null;
    status: string | null;
    settings: Record<string, unknown> | null;
    business_name: string | null;
};


function publicVehicleShape(row: Record<string, unknown>) {
    const gallery = Array.isArray(row.image_gallery) ? row.image_gallery : [];
    const imagesField = typeof row.images === "string" ? row.images : null;
    const photos =
        gallery.length > 0
            ? gallery.filter((u): u is string => typeof u === "string" && u.length > 0)
            : imagesField
              ? [imagesField]
              : [];

    return {
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim ?? null,
        stock_number: row.stock_number ?? null,
        vin_masked: maskVinForPublic(row.vin as string | undefined),
        odometer: row.odometer ?? null,
        condition: row.condition ?? null,
        exterior_color: row.exterior_color ?? null,
        interior_color: row.interior_color ?? null,
        fuel_type: row.fuel_type ?? null,
        transmission: row.transmission ?? null,
        drivetrain: row.drivetrain ?? null,
        body_style: row.body_style ?? null,
        retail_price: row.retail_price ?? null,
        special_price: row.special_price ?? null,
        photos,
        photo: photos[0] ?? null,
        description: row.description ?? null,
        features: Array.isArray(row.features) ? row.features : [],
    };
}

async function resolveDealership(params: {
    dealershipId: string | null;
    slug: string | null;
    token: string | null;
}): Promise<{ dealership: DealershipRow | null; error: string | null; status: number }> {
    const { dealershipId, slug, token } = params;

    if (!dealershipId && !slug && !token) {
        return {
            dealership: null,
            error: "Missing dealership scope. Provide dealership_id, slug, or token.",
            status: 400,
        };
    }

    if (token) {
        const { data: rows, error } = await supabaseAdmin
            .from("dealerships")
            .select("id, name, slug, status, settings, business_name")
            .filter("settings->>embed_token", "eq", token)
            .limit(1);

        if (error) {
            return { dealership: null, error: error.message, status: 500 };
        }
        const match = (rows || [])[0] as DealershipRow | undefined;
        if (!match) {
            return { dealership: null, error: "Invalid embed token", status: 401 };
        }
        return { dealership: match, error: null, status: 200 };
    }

    let query = supabaseAdmin
        .from("dealerships")
        .select("id, name, slug, status, settings, business_name");

    if (dealershipId) {
        query = query.eq("id", dealershipId);
    } else if (slug) {
        query = query.eq("slug", slug);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
        return { dealership: null, error: error.message, status: 500 };
    }
    if (!data) {
        return { dealership: null, error: "Dealership not found", status: 404 };
    }

    return { dealership: data as DealershipRow, error: null, status: 200 };
}

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const dealershipId = url.searchParams.get("dealership_id");
        const slug = url.searchParams.get("slug");
        const token =
            url.searchParams.get("token") ||
            url.searchParams.get("embed_token");
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
        const make = sanitizePublicExactFilter(url.searchParams.get("make"));
        const model = sanitizePublicExactFilter(url.searchParams.get("model"));
        const year = parsePublicYear(url.searchParams.get("year"));
        const q = sanitizePublicSearchQuery(url.searchParams.get("q"));
        const includeJsonLd = url.searchParams.get("jsonld") === "1";
        // Multi-location (Tier 3): optional rooftop scope for embed/showroom.
        const locationId = url.searchParams.get("location_id") || url.searchParams.get("locationId");

        const resolved = await resolveDealership({ dealershipId, slug, token });
        if (!resolved.dealership) {
            return json({ error: resolved.error }, resolved.status);
        }

        const dealership = resolved.dealership;
        if (isDealershipEmbedBlocked(dealership.status)) {
            return json({ error: "Dealership inventory is not publicly available" }, 403);
        }

        // When resolving by id/slug without token, require a matching token if one is set
        // (optional open mode: if no embed_token configured, id/slug alone is enough).
        const settings = (dealership.settings || {}) as Record<string, unknown>;
        const configuredToken =
            typeof settings.embed_token === "string" ? settings.embed_token : null;
        if (configuredToken && !token) {
            // Allow dealership_id or slug without token only when embed is not locked.
            // Locked = embed_token_required true in settings.
            if (settings.embed_token_required === true) {
                return json({ error: "Embed token required" }, 401);
            }
        }

        const spec = publicVehicleQuerySpec(dealership.id);
        let query = supabaseAdmin
            .from("vehicles")
            .select(
                "id, year, make, model, trim, stock_number, vin, odometer, condition, exterior_color, interior_color, fuel_type, transmission, drivetrain, body_style, retail_price, special_price, image_gallery, images, description, features, status, dealership_id, created_at",
                { count: "exact" }
            )
            .eq("dealership_id", spec.dealershipId)
            .eq("status", spec.status)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (make) query = query.eq("make", make);
        if (model) query = query.eq("model", model);
        if (year != null) query = query.eq("year", year);
        if (locationId) query = query.eq("location_id", locationId);
        if (q) {
            query = query.or(
                `vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,stock_number.ilike.%${q}%`
            );
        }

        const { data, error: dbError, count } = await query;
        if (dbError) throw dbError;

        const { data: facetRows, error: facetError } = await supabaseAdmin
            .from("vehicles")
            .select("year, make, model")
            .eq("dealership_id", spec.dealershipId)
            .eq("status", spec.status)
            .limit(1000);
        if (facetError) throw facetError;

        const vehicles = (data || []).map((row) => publicVehicleShape(row as Record<string, unknown>));
        const facets = buildPublicFacets(facetRows || []);

        const payload: Record<string, unknown> = {
            dealership: {
                id: dealership.id,
                name: dealership.business_name || dealership.name,
                slug: dealership.slug,
            },
            data: vehicles,
            count: count || 0,
            limit,
            offset,
            facets,
        };

        if (includeJsonLd) {
            payload.jsonld = vehicles.map((v) => ({
                "@context": "https://schema.org",
                "@type": "Car",
                name: [v.year, v.make, v.model, v.trim].filter(Boolean).join(" "),
                brand: { "@type": "Brand", name: v.make },
                model: v.model,
                vehicleModelDate: v.year,
                mileageFromOdometer: v.odometer
                    ? {
                          "@type": "QuantitativeValue",
                          value: v.odometer,
                          unitCode: "KMT",
                      }
                    : undefined,
                color: v.exterior_color || undefined,
                image: v.photos,
                offers: {
                    "@type": "Offer",
                    priceCurrency: "CAD",
                    price: v.special_price ?? v.retail_price,
                    availability: "https://schema.org/InStock",
                },
            }));
        }

        return json(payload);
    } catch (error: unknown) {
        console.error("Error fetching public vehicles:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return json({ error: message }, 500);
    }
}
