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
 * Public read API — deals (sales_deals). Requires the `deals:read` scope.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiScope(req, "deals:read");
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const status = url.searchParams.get("deal_status");

    let query = supabaseAdmin
      .from("sales_deals")
      .select(
        "id, vehicle_id, customer_id, deal_status, deal_date, sale_price, down_payment, trade_in_value, finance_term, interest_rate, salesperson_id, created_at, vehicle:vehicles(id, year, make, model, vin), customer:customers(id, name, email, phone)",
        { count: "exact" }
      )
      .eq("dealership_id", auth.dealershipId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("deal_status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    return json({
      dealership_id: auth.dealershipId,
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("External deals error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
}
