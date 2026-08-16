// app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// GET all roles for the current user's dealership
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const query = applyTenantScope(
            supabase
                .from("roles")
                .select("*")
                .order("is_system", { ascending: false })
                .order("name", { ascending: true }),
            scope,
            "roles"
        );

        const { data, error: dbError } = await query;

        if (dbError) throw dbError;

        return NextResponse.json({ data: data || [] });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching roles:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create new role (dealership admin only)
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        // Only admins or platform admins can create roles
        if (currentUser.role !== "Admin" && !currentUser.is_platform_admin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }

        const payload = await req.json();
        const { name, description, permissions } = payload;
        const writeScope = tenantScopeFromRequest(tenant, req);

        // Validate required fields
        if (!name) {
            return NextResponse.json(
                { error: "Missing required field: name" },
                { status: 400 }
            );
        }

        // Validate role name
        const validRoleNames = ["Admin", "Manager", "Salesperson", "Staff", "Custom"];
        if (!validRoleNames.includes(name)) {
            return NextResponse.json(
                { error: "Invalid role name. Must be Admin, Manager, Salesperson, Staff, or Custom" },
                { status: 400 }
            );
        }

        const { data, error: dbError } = await supabase
            .from("roles")
            .insert({
                name,
                description: description || null,
                permissions: permissions || [],
                is_system: false,
                dealership_id: requireWriteDealershipId({
                    ...writeScope,
                    platformDealershipId:
                        writeScope.platformDealershipId ||
                        (isPlatformAdmin ? payload.dealership_id : undefined),
                }),
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === '23505') {
                return NextResponse.json(
                    { error: "A role with this name already exists for this dealership" },
                    { status: 400 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating role:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
