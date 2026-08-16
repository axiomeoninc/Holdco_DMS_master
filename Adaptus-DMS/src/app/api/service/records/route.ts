// Service records — list + create (dealership-scoped).
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { SERVICE_TYPES, SERVICE_STATUSES } from "@/src/lib/service";

const SELECT_COLS = `
    *,
    customer:customers(id, name, email, phone),
    vehicle:vehicles(id, vin, year, make, model, image_gallery, images)
`;

function shapeRecord(row: Record<string, unknown>) {
    return {
        ...row,
        customer: row.customer ?? null,
        vehicle: row.vehicle ?? null,
    };
}

/** GET service records. Filters: customer_id, vehicle_id, status, location_id, q. */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
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
        const customerId = url.searchParams.get("customer_id");
        const vehicleId = url.searchParams.get("vehicle_id");
        const status = url.searchParams.get("status");
        const locationId = url.searchParams.get("location_id") || url.searchParams.get("locationId");
        const q = url.searchParams.get("q");

        let query = supabaseAdmin
            .from("service_records")
            .select(SELECT_COLS, { count: "exact" })
            .eq("dealership_id", dealershipId)
            .order("service_date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (customerId) query = query.eq("customer_id", customerId);
        if (vehicleId) query = query.eq("vehicle_id", vehicleId);
        if (status) query = query.eq("status", status);
        if (locationId) query = query.eq("location_id", locationId);
        if (q) {
            const safe = q.replace(/[%*,()]/g, "").trim();
            if (safe) {
                query = query.or(
                    `notes.ilike.%${safe}%,performed_by.ilike.%${safe}%,service_type.ilike.%${safe}%`
                );
            }
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: (data || []).map((row) => shapeRecord(row as Record<string, unknown>)),
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        console.error("Error fetching service records:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/** POST create a service record. */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        if (!auth.profile.is_platform_admin && auth.profile.role !== "Admin" && auth.profile.role !== "Manager") {
            return NextResponse.json(
                { error: "Forbidden — Admin or Manager access required" },
                { status: 403 }
            );
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json();
        const targetDealership =
            auth.profile.is_platform_admin && typeof body.dealership_id === "string"
                ? body.dealership_id
                : dealershipId;
        if (!targetDealership) {
            return NextResponse.json({ error: "dealership_id required" }, { status: 400 });
        }

        if (!body.service_date) {
            return NextResponse.json({ error: "service_date is required" }, { status: 400 });
        }
        if (!SERVICE_TYPES.includes(body.service_type)) {
            return NextResponse.json(
                { error: `Invalid service_type. Must be one of: ${SERVICE_TYPES.join(", ")}` },
                { status: 400 }
            );
        }
        if (body.status && !SERVICE_STATUSES.includes(body.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${SERVICE_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }
        if (!body.customer_id && !body.vehicle_id) {
            return NextResponse.json(
                { error: "At least one of customer_id or vehicle_id is required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("service_records")
            .insert({
                dealership_id: targetDealership,
                location_id:
                    typeof body.location_id === "string" && body.location_id.trim()
                        ? body.location_id.trim()
                        : null,
                customer_id: body.customer_id || null,
                vehicle_id: body.vehicle_id || null,
                service_date: body.service_date,
                odometer: body.odometer != null ? Number(body.odometer) : null,
                service_type: body.service_type,
                status: body.status || "completed",
                notes: body.notes ? String(body.notes).trim() : null,
                cost: body.cost != null ? Number(body.cost) : null,
                performed_by: body.performed_by ? String(body.performed_by).trim() : null,
                created_by: auth.profile.id,
            })
            .select(SELECT_COLS)
            .single();

        if (error) throw error;
        return NextResponse.json({ data: shapeRecord(data as Record<string, unknown>) }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating service record:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
