// app/api/deals/[id]/route.ts
//
// P1-1 fix: all four handlers use `pickSupabaseClient` so platform admins
// get the service-role client (RLS bypass for cross-dealership ops) while
// regular users keep the request-scoped RLS client.
//
// P1-3 fix: the PATCH perm checks for `deals:close` / `deals:cancel` now
// run AFTER the 404/ownership check, so a non-existent deal returns 404
// regardless of who the caller is.
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, pickSupabaseClient, requireDealershipAccess } from "@/src/lib/auth-helpers";

const DEAL_ALLOWED_FIELDS = [
    "sale_price", "status", "deal_status", "down_payment", "finance_amount", "finance_term",
    "finance_interest_rate", "interest_rate", "finance_company", "salesperson_id",
    "vehicle_id", "customer_id", "trade_in_value", "notes", "deal_date",
    "warranty_package", "gap_coverage", "tire_coverage", "paint_protection",
    "extended_service", "admin_fee", "financing_notes", "commission_rate", "commission_amount",
] as const;

// GET single deal
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        let supabase;
        try {
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;

        // Narrow fetch first to assert ownership
        const { data: deal, error: dealError } = await supabase
            .from("sales_deals")
            .select("id, dealership_id, salesperson_id")
            .eq("id", id)
            .single();

        if (dealError || !deal) {
            if (dealError?.code === "PGRST116" || !deal) {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw dealError;
        }

        const deny = assertOwnershipOrDeny(deal, auth.profile);
        if (deny) return deny;

        // Now fetch full deal with relations
        const { data, error: dbError } = await supabase
            .from("sales_deals")
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status, condition),
                customer:customers(id, name, email, phone, address, city, province),
                salesperson:users!sales_deals_salesperson_id_fkey(id, full_name, email, avatar)
            `)
            .eq("id", id)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error fetching deal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT update deal (full update)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        let supabase;
        try {
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;
        const payload = await req.json();

        // Validate required fields (customer optional — cash / walk-in)
        const required = ["vehicle_id", "sale_price"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Validate deal_status if provided
        const validStatuses = ['Open', 'Negotiation', 'Down Payment', 'Finance', 'Pending', 'Paid Off', 'Closed', 'Lost', 'Cancelled'];
        if (payload.deal_status && !validStatuses.includes(payload.deal_status)) {
            return NextResponse.json(
                { error: `Invalid deal_status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("sales_deals")
            .select("id, dealership_id, salesperson_id, vehicle_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist + block dealership_id changes; preserve legacy field mapping
        const safePayload = pickAllowed(payload, DEAL_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        const updateData: Record<string, unknown> = {
            ...safePayload,
            deal_status: payload.deal_status,
            interest_rate: payload.interest_rate,
            notes: payload.notes,
            deal_date: payload.deal_date,
        };

        const { data, error: dbError } = await supabase
            .from("sales_deals")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status, condition),
                customer:customers(id, name, email, phone),
                salesperson:users!sales_deals_salesperson_id_fkey(id, full_name, email, avatar)
            `)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        // Handle vehicle status change when deal is closed
        const vehicleId = existing.vehicle_id || payload.vehicle_id;
        if (
            (payload.deal_status === "Paid Off" ||
                payload.deal_status === "Closed" ||
                Boolean(payload.close_deal)) &&
            vehicleId
        ) {
            await supabase
                .from("vehicles")
                .update({ status: "Sold" })
                .eq("id", vehicleId);
        } else if (payload.deal_status === "Cancelled" && vehicleId) {
            await supabase
                .from("vehicles")
                .update({ status: "Active" })
                .eq("id", vehicleId);
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating deal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update deal (partial update)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        let supabase;
        try {
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;
        const payload = await req.json();

        // Validate deal_status if being updated (cheap, no DB call)
        if (payload.deal_status) {
            const validStatuses = ['Open', 'Negotiation', 'Down Payment', 'Finance', 'Pending', 'Paid Off', 'Closed', 'Lost', 'Cancelled'];
            if (!validStatuses.includes(payload.deal_status)) {
                return NextResponse.json(
                    { error: `Invalid deal_status. Must be one of: ${validStatuses.join(', ')}` },
                    { status: 400 }
                );
            }
        }

        // P1-3: ownership check FIRST. Perm gates come after.
        const { data: existing, error: existingError } = await supabase
            .from("sales_deals")
            .select("id, dealership_id, salesperson_id, vehicle_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // P1-3: perm gates now run AFTER ownership/404, so a non-existent
        // deal returns 404 regardless of the caller's perms.
        const userRole = auth.profile.role;
        const userPerms = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;

        if (payload.deal_status === "Paid Off") {
            const canCloseDeal = isPlatformAdmin ||
                userRole === "Admin" ||
                userRole === "Manager" ||
                userPerms.includes("deals:close") ||
                userPerms.includes("*");
            if (!canCloseDeal) {
                return NextResponse.json(
                    { error: "Forbidden - You need deals:close permission to close deals" },
                    { status: 403 }
                );
            }
        }
        if (payload.deal_status === "Cancelled") {
            const canCancelDeal = isPlatformAdmin ||
                userRole === "Admin" ||
                userRole === "Manager" ||
                userPerms.includes("deals:cancel") ||
                userPerms.includes("*");
            if (!canCancelDeal) {
                return NextResponse.json(
                    { error: "Forbidden - You need deals:cancel permission to cancel deals" },
                    { status: 403 }
                );
            }
        }

        // Whitelist + block dealership_id changes; map to the real column names
        const safePayload = pickAllowed(payload, DEAL_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;
        // `status` / `deal_status` both map to DB column `deal_status` (kanban sends deal_status)
        const updateData: Record<string, unknown> = { ...safePayload };
        if (updateData.status !== undefined) {
            updateData.deal_status = updateData.status;
            delete updateData.status;
        }
        if (payload.deal_status !== undefined) {
            updateData.deal_status = payload.deal_status;
        }
        // Accept either legacy alias or real column name for desking persistence
        if (payload.finance_interest_rate !== undefined) {
            updateData.interest_rate = payload.finance_interest_rate;
            delete updateData.finance_interest_rate;
        } else if (payload.interest_rate !== undefined) {
            updateData.interest_rate = payload.interest_rate;
        }

        const { data, error: dbError } = await supabase
            .from("sales_deals")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status, condition),
                customer:customers(id, name, email, phone),
                salesperson:users!sales_deals_salesperson_id_fkey(id, full_name, email, avatar)
            `)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        // Handle vehicle status change when deal is closed / marked sold
        const shouldMarkSold =
            payload.deal_status === "Paid Off" ||
            payload.deal_status === "Closed" ||
            Boolean(payload.close_deal);
        if (shouldMarkSold && existing?.vehicle_id) {
            await supabase
                .from("vehicles")
                .update({ status: "Sold" })
                .eq("id", existing.vehicle_id);
        } else if (payload.deal_status === "Cancelled" && existing?.vehicle_id) {
            await supabase
                .from("vehicles")
                .update({ status: "Active" })
                .eq("id", existing.vehicle_id);
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating deal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE deal
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        let supabase;
        try {
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;

        // Get the deal to check ownership and reset vehicle status
        const { data: deal, error: dealError } = await supabase
            .from("sales_deals")
            .select("id, dealership_id, salesperson_id, vehicle_id, deal_status")
            .eq("id", id)
            .single();

        if (dealError) {
            if (dealError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw dealError;
        }

        const deny = assertOwnershipOrDeny(deal, auth.profile);
        if (deny) return deny;

        // If deal was Paid Off, reset vehicle to Active
        if (deal.deal_status === 'Paid Off' && deal.vehicle_id) {
            await supabase
                .from("vehicles")
                .update({ status: 'Active' })
                .eq("id", deal.vehicle_id);
        }

        const { error: dbError } = await supabase
            .from("sales_deals")
            .delete()
            .eq("id", id);

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            message: "Deal deleted successfully"
        });
    } catch (error: unknown) {
        console.error("Error deleting deal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
