// app/api/roles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pickAllowed, requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

const ROLE_ALLOWED_FIELDS = [
    "name", "description", "permissions",
] as const;

// GET single role
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const { id } = await params;

        const { data: role, error: dbError } = await scopedTable(
            supabase,
            "roles",
            scope
        )
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (dbError) throw dbError;
        if (!role) {
            return NextResponse.json(
                { error: "Role not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: role });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching role:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update role
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        if (auth.profile.role !== "Admin" && !isPlatformAdmin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }

        const { data: existingRole, error: existingError } = await scopedTable(
            supabase,
            "roles",
            scope
        )
            .select("id, dealership_id, is_system, description, permissions")
            .eq("id", id)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existingRole) {
            return NextResponse.json(
                { error: "Role not found" },
                { status: 404 }
            );
        }

        const payload = await req.json();

        const safePayload = pickAllowed(payload, ROLE_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        const { data, error: dbError } = await applyTenantScope(
            supabase
                .from("roles")
                .update({
                    ...safePayload,
                    description: safePayload.description !== undefined ? safePayload.description : existingRole.description,
                    permissions: safePayload.permissions !== undefined ? safePayload.permissions : existingRole.permissions,
                })
                .eq("id", id)
                .select(),
            scope,
            "roles"
        ).single();

        if (dbError) throw dbError;

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error updating role:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE role
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        if (auth.profile.role !== "Admin" && !isPlatformAdmin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }

        const { data: existingRole, error: existingError } = await scopedTable(
            supabase,
            "roles",
            scope
        )
            .select("id, dealership_id, is_system")
            .eq("id", id)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existingRole) {
            return NextResponse.json(
                { error: "Role not found" },
                { status: 404 }
            );
        }

        if (existingRole.is_system) {
            return NextResponse.json(
                { error: "Cannot delete system role" },
                { status: 403 }
            );
        }

        const { count } = await supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role_id", id);

        if (count && count > 0) {
            return NextResponse.json(
                { error: `Cannot delete role - ${count} user(s) are using this role` },
                { status: 400 }
            );
        }

        const { error: dbError } = await applyTenantScope(
            supabase.from("roles").delete().eq("id", id),
            scope,
            "roles"
        );

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error deleting role:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
