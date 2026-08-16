import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { requireApiScope } from "@/src/lib/api/require-scope";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Public read API — inventory. Scoped by the dealership of the API token.
 * Only Active vehicles are exposed; VIN is masked.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiScope(req, "inventory:read");
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const make = url.searchParams.get("make");
    const model = url.searchParams.get("model");
    const q = url.searchParams.get("q");

    let query = supabaseAdmin
      .from("vehicles")
      .select(
        "id, year, make, model, trim, stock_number, vin, odometer, condition, exterior_color, interior_color, fuel_type, transmission, drivetrain, body_style, retail_price, special_price, image_gallery, images, description, features, status, created_at",
        { count: "exact" }
      )
      .eq("dealership_id", auth.dealershipId)
      .eq("status", "Active")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (make) query = query.eq("make", make);
    if (model) query = query.eq("model", model);
    if (q) {
      query = query.or(
        `vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,stock_number.ilike.%${q}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const vehicles = (data || []).map((row) => {
      const gallery = Array.isArray(row.image_gallery) ? row.image_gallery : [];
      const imagesField = typeof row.images === "string" ? row.images : null;
      const photos =
        gallery.length > 0
          ? gallery.filter((u): u is string => typeof u === "string" && u.length > 0)
          : imagesField
            ? [imagesField]
            : [];
      const vin = typeof row.vin === "string" ? row.vin : "";
      return {
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim ?? null,
        stock_number: row.stock_number ?? null,
        vin_masked: vin.length > 8 ? `${vin.slice(0, 4)}…${vin.slice(-4)}` : vin,
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
    });

    return json({
      dealership_id: auth.dealershipId,
      data: vehicles,
      count: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("External inventory error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
}
