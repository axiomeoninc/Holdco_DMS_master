// app/api/dealerships/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const DEALERSHIP_ALLOWED_FIELDS = [
    "name", "address", "phone", "email", "logo_url", "settings",
    // Schema-actual columns used by the dealerships table
    "slug", "subdomain", "business_name", "business_address", "business_phone",
    "business_email", "status",
] as const;

// GET single dealership — platform admin (any) or member of that dealership
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

        const { id } = await params;
        const isPlatformAdmin = Boolean(auth.profile.is_platform_admin);
        const ownDealership = auth.profile.dealership_id === id;

        if (!isPlatformAdmin && !ownDealership) {
            return NextResponse.json(
                { error: "Unauthorized - Platform admin or own dealership access required" },
                { status: 403 }
            );
        }

        const supabase = supabaseAdmin;

        const { data: dealership, error: dbError } = await supabase
            .from("dealerships")
            .select("*")
            .eq("id", id)
            .single();

        if (dbError || !dealership) {
            return NextResponse.json(
                { error: "Dealership not found" },
                { status: 404 }
            );
        }

        // Get subscription info
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("dealership_id", id)
            .single();

        // Billing details: platform admin only (tenant UI uses /settings/billing)
        let billingInformation = null;
        if (isPlatformAdmin) {
            const { data } = await supabase
                .from("billing_information")
                .select("*")
                .eq("dealership_id", id)
                .single();
            billingInformation = data;
        }

        // Get user count
        const { count: userCount } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("dealership_id", id);

        return NextResponse.json({
            data: {
                ...dealership,
                subscription,
                billing_information: billingInformation,
                user_count: userCount || 0
            }
        });
    } catch (error: unknown) {
        console.error("Error fetching dealership:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update dealership (platform admin only) - also handles suspend/activate actions
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        if (!auth.profile.is_platform_admin) {
            return NextResponse.json(
                { error: "Unauthorized - Platform admin access required" },
                { status: 403 }
            );
        }

        const supabase = supabaseAdmin;

        const url = new URL(req.url);
        const action = url.searchParams.get("action");

        // Handle suspend/activate actions
        if (action === "suspend" || action === "activate") {
            const newStatus = action === "suspend" ? "Suspended" : "Active";

            // Verify the row exists; platform admin always passes ownership
            const { data: existing, error: existingError } = await supabase
                .from("dealerships")
                .select("id")
                .eq("id", id)
                .single();

            if (existingError) {
                if (existingError.code === "PGRST116") {
                    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
                }
                throw existingError;
            }

            const deny = assertOwnershipOrDeny(
                existing as { dealership_id?: string | null; assigned_to?: string | null } | null,
                auth.profile
            );
            if (deny) return deny;

            const { data: dealership, error: dbError } = await supabase
                .from("dealerships")
                .update({ status: newStatus })
                .eq("id", id)
                .select()
                .single();

            if (dbError) {
                if (dbError.code === "PGRST116") {
                    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
                }
                throw dbError;
            }

            // Deactivate/reactivate all users in the dealership
            const newIsActive = action === "activate";
            await supabase
                .from("users")
                .update({ is_active: newIsActive })
                .eq("dealership_id", id);

            // Log audit action
            await supabase.rpc("log_audit_action", {
                p_action: `dealership.${action}`,
                p_entity_type: "dealership",
                p_entity_id: id,
                p_actor_id: auth.user?.id,
                p_metadata: JSON.stringify({ status: newStatus }),
            });

            return NextResponse.json({
                data: dealership,
                message: action === "suspend"
                    ? "Dealership suspended successfully. All users in this dealership have been deactivated."
                    : "Dealership activated successfully. All users in this dealership have been activated."
            });
        }

        // Normal update logic
        const payload = await req.json();

        // Whitelist the update payload
        const safePayload = pickAllowed(payload, DEALERSHIP_ALLOWED_FIELDS);

        if (Object.keys(safePayload).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Verify the row exists; platform admin always passes ownership
        const { data: existing, error: existingError } = await supabase
            .from("dealerships")
            .select("id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Dealership not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(
            existing as { dealership_id?: string | null; assigned_to?: string | null } | null,
            auth.profile
        );
        if (deny) return deny;

        const { data: dealership, error: dbError } = await supabase
            .from("dealerships")
            .update(safePayload)
            .eq("id", id)
            .select()
            .single();

        if (dbError) {
            if (dbError.code === '23505') {
                return NextResponse.json(
                    { error: "A dealership with this slug or subdomain already exists" },
                    { status: 400 }
                );
            }
            throw dbError;
        }

        if (!dealership) {
            return NextResponse.json(
                { error: "Dealership not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: dealership });
    } catch (error: unknown) {
        console.error("Error updating dealership:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// Soft-delete dealership (platform admin only).
// Never hard-delete tenants that have vehicles / deals / invoices (protects Nova floors).
const NOVA_DEALERSHIP_ID = "dd404bb6-3e64-43ae-9eb7-98095033c6cb";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        if (!auth.profile.is_platform_admin) {
            return NextResponse.json(
                { error: "Unauthorized - Platform admin access required" },
                { status: 403 }
            );
        }

        const supabase = supabaseAdmin;

        const { data: existing, error: existingError } = await supabase
            .from("dealerships")
            .select("id, name, status")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(
            existing as { dealership_id?: string | null; assigned_to?: string | null } | null,
            auth.profile
        );
        if (deny) return deny;

        // Count tenant data — any operational data forces soft-delete only
        const [
            { count: vehicleCount },
            { count: dealCount },
            { count: invoiceCount },
            { count: userCount },
        ] = await Promise.all([
            supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("dealership_id", id),
            supabase.from("sales_deals").select("*", { count: "exact", head: true }).eq("dealership_id", id),
            supabase.from("invoices").select("*", { count: "exact", head: true }).eq("dealership_id", id),
            supabase.from("users").select("*", { count: "exact", head: true }).eq("dealership_id", id),
        ]);

        const hasTenantData =
            (vehicleCount || 0) > 0 ||
            (dealCount || 0) > 0 ||
            (invoiceCount || 0) > 0 ||
            id === NOVA_DEALERSHIP_ID;

        if (hasTenantData) {
            // Soft-delete: Cancelled + deactivate users. Never wipe inventory/deals/invoices.
            const { data: dealership, error: softError } = await supabase
                .from("dealerships")
                .update({ status: "Cancelled" })
                .eq("id", id)
                .select()
                .single();

            if (softError) throw softError;

            await supabase
                .from("users")
                .update({ is_active: false })
                .eq("dealership_id", id)
                .eq("is_platform_admin", false);

            try {
                await supabase.rpc("log_audit_action", {
                    p_action: "dealership.soft_delete",
                    p_entity_type: "dealership",
                    p_entity_id: id,
                    p_actor_id: auth.user?.id,
                    p_metadata: JSON.stringify({
                        reason: "tenant_has_data",
                        vehicles: vehicleCount || 0,
                        deals: dealCount || 0,
                        invoices: invoiceCount || 0,
                        users: userCount || 0,
                    }),
                });
            } catch {
                /* audit is best-effort */
            }

            return NextResponse.json({
                success: true,
                soft_deleted: true,
                data: dealership,
                message:
                    "Dealership soft-deleted (Cancelled). Tenant data retained — vehicles/deals/invoices were not removed.",
                retained: {
                    vehicles: vehicleCount || 0,
                    deals: dealCount || 0,
                    invoices: invoiceCount || 0,
                    users: userCount || 0,
                },
            });
        }

        // Empty tenant only: allow hard delete of shell records
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status")
            .eq("dealership_id", id)
            .maybeSingle();

        if (subscription && subscription.status === "Active") {
            return NextResponse.json(
                { error: "Cannot delete dealership with active subscription. Cancel the subscription first." },
                { status: 400 }
            );
        }

        await supabase.from("users").delete().eq("dealership_id", id);
        await supabase.from("roles").delete().eq("dealership_id", id);
        await supabase.from("subscriptions").delete().eq("dealership_id", id);
        await supabase.from("billing_information").delete().eq("dealership_id", id);

        const { error: dbError } = await supabase
            .from("dealerships")
            .delete()
            .eq("id", id);

        if (dbError) throw dbError;

        return NextResponse.json({
            success: true,
            soft_deleted: false,
            message: "Empty dealership hard-deleted.",
        });
    } catch (error: unknown) {
        console.error("Error deleting dealership:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
