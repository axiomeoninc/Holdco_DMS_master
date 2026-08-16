// app/api/follow-ups/[id]/route.ts
//
// P1-1 fix: all four handlers use `pickSupabaseClient` so platform admins
// get the service-role client (RLS bypass for cross-dealership ops) while
// regular users keep the request-scoped RLS client.
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, pickSupabaseClient, requireDealershipAccess } from "@/src/lib/auth-helpers";

const FOLLOWUP_ALLOWED_FIELDS = [
    "type", "due_date", "status", "notes", "assigned_to", "lead_id", "customer_id",
    "title", "description", "follow_up_date", "follow_up_time", "priority",
] as const;

// GET single follow-up
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
        const { data: existing, error: existingError } = await supabase
            .from("follow_ups")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Follow-up not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Re-fetch the full row with relations
        const { data, error: dbError } = await supabase
            .from("follow_ups")
            .select(`
                *,
                customer:customers(id, name, email, phone),
                assigned_user:users!assigned_to(id, full_name, email),
                created_by_user:users!created_by(id, full_name, email),
                completed_by_user:users!completed_by(id, full_name, email)
            `)
            .eq("id", id)
            .single();

        if (dbError) throw dbError;

        if (!data) {
            return NextResponse.json(
                { error: "Follow-up not found" },
                { status: 404 }
            );
        }

        // Get history
        const { data: history } = await supabase
            .from("follow_up_history")
            .select(`
                *,
                edited_by_user:users!edited_by(id, full_name, email)
            `)
            .eq("follow_up_id", id)
            .order("created_at", { ascending: true });

        return NextResponse.json({ data: { ...data, history: history || [] } });
    } catch (error: unknown) {
        console.error("Error fetching follow-up:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update follow-up
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

        // Validate status if provided
        const validStatuses = ['Pending', 'Completed', 'Cancelled'];
        if (payload.status && !validStatuses.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate priority if provided
        const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
        if (payload.priority && !validPriorities.includes(payload.priority)) {
            return NextResponse.json(
                { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("follow_ups")
            .select("id, dealership_id, assigned_to, description, status")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Follow-up not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, FOLLOWUP_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        // Build update data
        const updateData: Record<string, unknown> = { ...safePayload };

        if (updateData.status === 'Completed') {
            updateData.completed_at = new Date().toISOString();
            updateData.completed_by = auth.user?.id ?? null;
        } else if (updateData.status === 'Pending' || updateData.status === 'Cancelled') {
            updateData.completed_at = null;
            updateData.completed_by = null;
        }

        const { data, error: dbError } = await supabase
            .from("follow_ups")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                customer:customers(id, name, email, phone),
                assigned_user:users!assigned_to(id, full_name, email),
                created_by_user:users!created_by(id, full_name, email),
                completed_by_user:users!completed_by(id, full_name, email)
            `)
            .single();

        if (dbError) throw dbError;

        if (!data) {
            return NextResponse.json(
                { error: "Follow-up not found" },
                { status: 404 }
            );
        }

        // Create history entry for the update
        let historyAction = "updated";
        if (updateData.status === 'Completed' && existing?.status !== 'Completed') {
            historyAction = "completed";
        } else if (updateData.status === 'Cancelled') {
            historyAction = "cancelled";
        } else if (updateData.status !== undefined && updateData.status !== existing?.status) {
            historyAction = "status_changed";
        }

        await supabase
            .from("follow_up_history")
            .insert({
                follow_up_id: id,
                edited_by: auth.user?.id,
                action: historyAction,
                previous_description: existing?.description,
                new_description: updateData.description !== undefined ? updateData.description : existing?.description,
                previous_status: existing?.status,
                new_status: updateData.status !== undefined ? updateData.status : existing?.status,
            });

        // Get updated history
        const { data: history } = await supabase
            .from("follow_up_history")
            .select(`
                *,
                edited_by_user:users!edited_by(id, full_name, email)
            `)
            .eq("follow_up_id", id)
            .order("created_at", { ascending: true });

        return NextResponse.json({ data: { ...data, history: history || [] } });
    } catch (error: unknown) {
        console.error("Error updating follow-up:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE follow-up
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

        const userRole = auth.profile.role;
        const userPerms = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;

        const canDelete = isPlatformAdmin ||
            userRole === "Admin" ||
            userRole === "Manager" ||
            userPerms.includes("follow_ups:delete") ||
            userPerms.includes("*");

        if (!canDelete) {
            return NextResponse.json(
                { error: "Forbidden - You need follow_ups:delete permission to delete follow-ups" },
                { status: 403 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("follow_ups")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Follow-up not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const { error: dbError } = await supabase
            .from("follow_ups")
            .delete()
            .eq("id", id);

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting follow-up:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
