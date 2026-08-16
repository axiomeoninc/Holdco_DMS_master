// Single service record — PATCH + DELETE (dealership-scoped).
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

async function loadScoped(
    req: NextRequest,
    auth: Awaited<ReturnType<typeof requireDealershipAccess>>,
    id: string
) {
    const { data, error } = await supabaseAdmin
        .from("service_records")
        .select(SELECT_COLS)
        .eq("id", id)
        .maybeSingle();
    if (error) throw error;
    if (!data) return { row: null as null, error: "Record not found", status: 404 };
    if (
        !auth.profile!.is_platform_admin &&
        (data as Record<string, unknown>).dealership_id !== auth.dealership_id
    ) {
        return { row: null as null, error: "Record not found", status: 404 };
    }
    return { row: data as Record<string, unknown>, error: null as null, status: 200 };
}

const PATCH_FIELDS = [
    "service_date",
    "odometer",
    "service_type",
    "status",
    "notes",
    "cost",
    "performed_by",
    "location_id",
] as const;

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
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

        const { id } = await context.params;
        const loaded = await loadScoped(req, auth, id);
        if (!loaded.row) {
            return NextResponse.json({ error: loaded.error }, { status: loaded.status });
        }

        const body = await req.json();
        const patch: Record<string, unknown> = {};
        for (const field of PATCH_FIELDS) {
            if (body[field] === undefined) continue;
            if (field === "service_type") {
                if (!SERVICE_TYPES.includes(body[field])) {
                    return NextResponse.json(
                        { error: `Invalid service_type. Must be one of: ${SERVICE_TYPES.join(", ")}` },
                        { status: 400 }
                    );
                }
                patch.service_type = body[field];
            } else if (field === "status") {
                if (!SERVICE_STATUSES.includes(body[field])) {
                    return NextResponse.json(
                        { error: `Invalid status. Must be one of: ${SERVICE_STATUSES.join(", ")}` },
                        { status: 400 }
                    );
                }
                patch.status = body[field];
            } else if (field === "service_date") {
                if (!body[field]) {
                    return NextResponse.json({ error: "service_date is required" }, { status: 400 });
                }
                patch.service_date = body[field];
            } else if (field === "odometer" || field === "cost") {
                patch[field] = body[field] == null || body[field] === "" ? null : Number(body[field]);
            } else if (field === "notes" || field === "performed_by") {
                const raw = body[field];
                patch[field] = raw == null || raw === "" ? null : String(raw).trim();
            } else if (field === "location_id") {
                const raw = body[field];
                patch[field] = raw == null || raw === "" ? null : String(raw).trim();
            }
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("service_records")
            .update(patch)
            .eq("id", id)
            .select(SELECT_COLS)
            .single();
        if (error) throw error;

        return NextResponse.json({ data: shapeRecord(data as Record<string, unknown>) });
    } catch (error: unknown) {
        console.error("Error updating service record:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
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

        const { id } = await context.params;
        const loaded = await loadScoped(req, auth, id);
        if (!loaded.row) {
            return NextResponse.json({ error: loaded.error }, { status: loaded.status });
        }

        const { error } = await supabaseAdmin
            .from("service_records")
            .delete()
            .eq("id", id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting service record:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
