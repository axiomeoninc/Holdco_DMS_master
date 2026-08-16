// app/api/leads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { scoreLead } from "@/src/lib/business/lead-score";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const LEAD_ALLOWED_FIELDS = [
    "source", "status", "notes", "assigned_to", "interest_vehicle_id", "last_engagement",
    "score", "temperature", "converted_deal_id",
] as const;

// GET single lead
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

        const supabase = supabaseAdmin;

        const userPerms = auth.profile?.user_permissions || [];
        const isAdminOrManager = auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";

        const hasFullRead = isAdminOrManager || userPerms.includes("leads:read");
        const hasAssignedOnly = userPerms.includes("leads:read:assigned") && !userPerms.includes("leads:read");

        if (!hasFullRead && !hasAssignedOnly) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const { id } = await params;

        // Narrow fetch first to assert ownership without leaking other columns
        const { data: lead, error: dbError } = await supabase
            .from("leads")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (dbError || !lead) {
            if (dbError?.code === "PGRST116" || !lead) {
                return NextResponse.json({ error: "Lead not found" }, { status: 404 });
            }
            throw dbError;
        }

        const deny = assertOwnershipOrDeny(lead, auth.profile);
        if (deny) return deny;

        // If has assigned-only permission, verify ownership on the row
        if (hasAssignedOnly && lead.assigned_to !== auth.user?.id) {
            return NextResponse.json({ error: "Access denied - you can only view assigned leads" }, { status: 403 });
        }

        // Fetch full lead with relations
        const { data: fullLead } = await supabase
            .from("leads")
            .select(`
                *,
                customer:customers(*),
                vehicle:vehicles(*),
                assigned_user:users!assigned_to(id, full_name, email, avatar)
            `)
            .eq("id", id)
            .single();

        return NextResponse.json({ data: fullLead });
    } catch (error: unknown) {
        console.error("Error fetching lead:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT update lead (full update)
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

        const supabase = supabaseAdmin;

        const { id } = await params;
        const payload = await req.json();

        // Validate required fields for full update
        const required = ["customer_id"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Validate source if provided
        const validSources = ['Website', 'Referral', 'Event', 'Walk-in', 'Facebook', 'Craigslist', 'Kijiji', 'Phone'];
        if (payload.source && !validSources.includes(payload.source)) {
            return NextResponse.json(
                { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate status if provided
        const validStatuses = ['Not Started', 'In Progress', 'Qualified', 'Closed', 'Lost'];
        if (payload.status && !validStatuses.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("leads")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist + block dealership_id changes; always update last_engagement/updated_at
        const safePayload = pickAllowed(payload, LEAD_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        const updateData = {
            ...safePayload,
            customer_id: payload.customer_id,
            last_engagement: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data, error: dbError } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                customer:customers(*),
                vehicle:vehicles(*),
                assigned_user:users!assigned_to(id, full_name, email, avatar)
            `)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating lead:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update lead (partial update)
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

        const supabase = supabaseAdmin;

        const userRole = auth.profile.role;
        const userPermissions = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;
        const canAssign = isPlatformAdmin || userRole === "Admin" || userRole === "Manager" || userPermissions.includes("leads:assign");

        const { id } = await params;
        const payload = await req.json();

        // If changing assigned_to, require leads:assign permission
        if (payload.assigned_to !== undefined && !canAssign) {
            return NextResponse.json(
                { error: "Forbidden - You need leads:assign permission to reassign leads" },
                { status: 403 }
            );
        }

        // Assert ownership before any write (include score inputs)
        const { data: existing, error: existingError } = await supabase
            .from("leads")
            .select(
                "id, dealership_id, assigned_to, source, status, interest_vehicle_id, notes, lead_creation_date, created_at"
            )
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, LEAD_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        if (Object.keys(safePayload).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Validate source if provided
        const validSources = ['Website', 'Referral', 'Event', 'Walk-in', 'Facebook', 'Craigslist', 'Kijiji', 'Phone'];
        if (safePayload.source && !validSources.includes(safePayload.source as string)) {
            return NextResponse.json(
                { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate status if provided
        const validStatuses = ['Not Started', 'In Progress', 'Qualified', 'Closed', 'Lost'];
        if (safePayload.status && !validStatuses.includes(safePayload.status as string)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        // Build update data; always bump last_engagement/updated_at + re-score
        const now = new Date().toISOString();
        const scored = scoreLead({
            source: (safePayload.source as string | undefined) ?? existing.source,
            status: (safePayload.status as string | undefined) ?? existing.status,
            interest_vehicle_id:
                (safePayload.interest_vehicle_id as string | null | undefined) ??
                existing.interest_vehicle_id,
            notes:
                (safePayload.notes as string | null | undefined) ?? existing.notes,
            last_engagement: now,
            lead_creation_date: existing.lead_creation_date || existing.created_at,
        });
        const updateData: Record<string, unknown> = {
            ...safePayload,
            updated_at: now,
            last_engagement: now,
            score: scored.score,
            temperature: scored.temperature,
        };

        const { data, error: dbError } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                customer:customers(*),
                vehicle:vehicles(*),
                assigned_user:users!assigned_to(id, full_name, email, avatar)
            `)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating lead:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE lead
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

        const supabase = supabaseAdmin;

        const userRole = auth.profile.role;
        const userPerms = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;

        // Check leads:delete permission
        const canDelete = isPlatformAdmin ||
            userRole === "Admin" ||
            userRole === "Manager" ||
            userPerms.includes("leads:delete") ||
            userPerms.includes("*");

        if (!canDelete) {
            return NextResponse.json(
                { error: "Forbidden - You need leads:delete permission to delete leads" },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("leads")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const { error: dbError } = await supabase
            .from("leads")
            .delete()
            .eq("id", id);

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Lead not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            message: "Lead deleted successfully"
        });
    } catch (error: unknown) {
        console.error("Error deleting lead:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}