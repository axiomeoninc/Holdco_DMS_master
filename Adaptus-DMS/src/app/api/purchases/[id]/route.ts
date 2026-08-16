import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

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
] as const;

async function loadScopedPurchase(id: string, dealershipId: string | null, isPlatformAdmin: boolean) {
    const { data, error } = await supabaseAdmin
        .from("purchase_from_public")
        .select(
            `
            *,
            vehicle:vehicles(id, vin, year, make, model, stock_number, status, purchase_price)
        `
        )
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    if (!isPlatformAdmin && data.dealership_id !== dealershipId) {
        return "forbidden" as const;
    }
    return data;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const row = await loadScopedPurchase(
            id,
            auth.profile.dealership_id,
            Boolean(auth.profile.is_platform_admin)
        );
        if (row === "forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!row) {
            return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
        }
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        console.error("Error fetching purchase:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const existing = await loadScopedPurchase(
            id,
            auth.profile.dealership_id,
            Boolean(auth.profile.is_platform_admin)
        );
        if (existing === "forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!existing) {
            return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
        }

        const body = await req.json();
        const patch: Record<string, unknown> = {};

        for (const key of PURCHASE_PATCH_FIELDS) {
            if (body[key] === undefined) continue;
            if (key === "purchase_price") {
                const n = Number(body.purchase_price);
                if (Number.isNaN(n)) {
                    return NextResponse.json({ error: "Invalid purchase_price" }, { status: 400 });
                }
                patch.purchase_price = n;
                continue;
            }
            if (key === "seller_name") {
                const name = String(body.seller_name || "").trim();
                if (!name) {
                    return NextResponse.json({ error: "seller_name is required" }, { status: 400 });
                }
                patch.seller_name = name;
                continue;
            }
            if (key === "vin_verified" || key === "title_received") {
                patch[key] = Boolean(body[key]);
                continue;
            }
            if (key === "seller_phone" || key === "seller_address" || key === "title_number" || key === "notes") {
                const v = body[key];
                patch[key] = v == null || v === "" ? null : String(v).trim();
                continue;
            }
            if (key === "purchase_date") {
                if (!body.purchase_date) {
                    return NextResponse.json({ error: "purchase_date is required" }, { status: 400 });
                }
                patch.purchase_date = String(body.purchase_date);
            }
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const existing = await loadScopedPurchase(
            id,
            auth.profile.dealership_id,
            Boolean(auth.profile.is_platform_admin)
        );
        if (existing === "forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!existing) {
            return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
        }

        // Delete purchase record only — do not delete linked vehicles (inventory floor).
        const { error } = await supabaseAdmin.from("purchase_from_public").delete().eq("id", id);
        if (error) throw error;

        return NextResponse.json({ ok: true, id });
    } catch (error: unknown) {
        console.error("Error deleting purchase:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
