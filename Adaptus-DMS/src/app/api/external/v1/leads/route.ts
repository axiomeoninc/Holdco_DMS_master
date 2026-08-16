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
 * Public read API — leads. Requires the `leads:read` scope.
 * Only lightweight CRM metadata (no internal notes by default).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiScope(req, "leads:read");
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const status = url.searchParams.get("status");
    const includeNotes = url.searchParams.get("include_notes") === "1";

    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, customer_id, interest_vehicle_id, source, status, assigned_to, lead_creation_date, last_engagement, created_at, customer:customers(id, name, email, phone), vehicle:vehicles(id, year, make, model)",
        { count: "exact" }
      )
      .eq("dealership_id", auth.dealershipId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    const leads = (data || []).map((row) => {
      const { notes: _notes, ...rest } = row as Record<string, unknown>;
      void _notes;
      return includeNotes ? rest : { ...rest, notes: undefined };
    });

    return json({
      dealership_id: auth.dealershipId,
      data: leads,
      count: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("External leads error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
}
