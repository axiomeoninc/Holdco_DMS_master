// app/api/users/[id]/route.ts
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { pickAllowed, requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

const USER_ALLOWED_FIELDS = [
    "full_name", "role", "phone", "avatar", "start_date", "user_permissions", "is_active",
] as const;

const USER_PLATFORM_ADMIN_ALLOWED_FIELDS = [
    ...USER_ALLOWED_FIELDS, "is_platform_admin",
] as const;

const USER_SELECT =
    "id,avatar,full_name,role,email,phone,start_date,created_at,updated_at,user_permissions,dealership_id,is_active";

// GET single user
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        if (!isPlatformAdmin && currentUser.role !== "Admin") {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
        }

        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;

        const { data: targetUser, error: dbError } = await scopedTable(
            supabase,
            "users",
            scope
        )
            .select(USER_SELECT)
            .eq("id", id)
            .maybeSingle();

        if (dbError) throw dbError;
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ data: targetUser });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching user:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update user (or suspend/reactivate)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        if (!isPlatformAdmin && currentUser.role !== "Admin") {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
        }

        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;
        const url = new URL(req.url);
        const action = url.searchParams.get("action");

        const { data: targetUser, error: targetError } = await scopedTable(
            supabase,
            "users",
            scope
        )
            .select("id, dealership_id, is_platform_admin")
            .eq("id", id)
            .maybeSingle();

        if (targetError) throw targetError;
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (action === "suspend" || action === "reactivate") {
            if (id === auth.user?.id) {
                return NextResponse.json({ error: "Cannot suspend your own account" }, { status: 400 });
            }

            if (targetUser.is_platform_admin) {
                return NextResponse.json({ error: "Cannot suspend platform admin" }, { status: 403 });
            }

            const is_active = action === "reactivate";

            const { data, error: dbError } = await applyTenantScope(
                supabase
                    .from("users")
                    .update({ is_active })
                    .eq("id", id)
                    .select(),
                scope,
                "users"
            ).single();

            if (dbError) throw dbError;

            return NextResponse.json({
                data,
                message: action === "suspend"
                    ? "User suspended successfully. They can no longer log in."
                    : "User reactivated successfully."
            });
        }

        const payload = await req.json();

        if (!isPlatformAdmin && payload.is_platform_admin === true) {
            return NextResponse.json(
                { error: "Forbidden - Cannot set is_platform_admin" },
                { status: 403 }
            );
        }

        const allowedFields = isPlatformAdmin
            ? USER_PLATFORM_ADMIN_ALLOWED_FIELDS
            : USER_ALLOWED_FIELDS;
        const safePayload = pickAllowed(payload, allowedFields);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        if (Object.keys(safePayload).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        if (safePayload.role) {
            const validRoles = ["Admin", "Staff", "Manager", "Salesperson"];
            if (!validRoles.includes(safePayload.role as string)) {
                return NextResponse.json(
                    { error: "Invalid role. Must be Admin, Staff, Manager, or Salesperson" },
                    { status: 400 }
                );
            }
        }

        const { data, error: dbError } = await applyTenantScope(
            supabase
                .from("users")
                .update(safePayload)
                .eq("id", id)
                .select(),
            scope,
            "users"
        ).single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error updating user:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE user
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        if (!isPlatformAdmin && currentUser.role !== "Admin") {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
        }

        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;

        if (id === auth.user?.id) {
            return NextResponse.json(
                { error: "You cannot delete your own account" },
                { status: 400 }
            );
        }

        const { data: targetUser, error: targetError } = await scopedTable(
            supabase,
            "users",
            scope
        )
            .select("id, dealership_id, is_platform_admin")
            .eq("id", id)
            .maybeSingle();

        if (targetError) throw targetError;
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (targetUser.is_platform_admin) {
            return NextResponse.json({ error: "Cannot delete platform admin" }, { status: 403 });
        }

        // Junction table has no dealership_id — only delete after the user row is rooftop-scoped.
        await supabase.from("user_roles").delete().eq("user_id", id);

        const { error: dbError } = await applyTenantScope(
            supabase.from("users").delete().eq("id", id),
            scope,
            "users"
        );

        if (dbError) throw dbError;

        try {
            await supabaseAdmin.auth.admin.deleteUser(id);
        } catch (authDeleteError) {
            console.error("Error deleting auth user:", authDeleteError);
        }

        return NextResponse.json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error deleting user:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
