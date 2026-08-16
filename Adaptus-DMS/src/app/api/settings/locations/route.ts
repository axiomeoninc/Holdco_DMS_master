// Dealership locations (multi-location / rooftop) CRUD.
// Additive + backward-compatible: location_id is optional on records (NULL = legacy).
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

function canManageSettings(profile: {
    role?: string | null;
    is_platform_admin?: boolean | null;
    user_permissions?: string[] | null;
}): boolean {
    if (profile.is_platform_admin) return true;
    if (profile.role === "Admin" || profile.role === "Manager") return true;
    const perms = profile.user_permissions || [];
    if (perms.includes("*")) return true;
    return perms.includes("settings:write") || perms.includes("settings:company");
}

const SELECT_COLS =
    "id, dealership_id, name, code, address, phone, email, is_active, is_primary, hours, settings, created_at, updated_at";

function shapeLocation(row: Record<string, unknown>) {
    return {
        id: row.id,
        dealership_id: row.dealership_id,
        name: row.name,
        code: row.code ?? null,
        address: row.address ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        is_active: row.is_active === true,
        is_primary: row.is_primary === true,
        hours: row.hours ?? null,
        settings: (row.settings || {}) as Record<string, unknown>,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/** GET locations for the caller's dealership (or Act-as rooftop for platform). */
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        let query = scopedTable(supabase, "locations", scope)
            .select(SELECT_COLS)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true });

        const includeInactive = url.searchParams.get("include_inactive") === "1";
        if (!includeInactive) {
            query = query.eq("is_active", true);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: (data || []).map((row: Record<string, unknown>) =>
                shapeLocation(row)
            ),
            can_edit: canManageSettings(auth.profile),
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching locations:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}

/** POST create a location. */
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        if (!canManageSettings(auth.profile)) {
            return NextResponse.json(
                { error: "Forbidden — Admin/Manager or settings:write required" },
                { status: 403 }
            );
        }

        const writeScope = tenantScopeFromRequest(tenant, req);
        const dealershipId = requireWriteDealershipId(writeScope);

        const body = (await req.json()) as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
            return NextResponse.json(
                { error: "Location name is required" },
                { status: 400 }
            );
        }

        const { data: existing, error: countErr } = await scopedTable(
            supabase,
            "locations",
            writeScope
        ).select("id", { count: "exact", head: true });
        if (countErr) throw countErr;
        const isFirst = (existing?.length ?? 0) === 0;

        const { data, error } = await supabase
            .from("locations")
            .insert({
                dealership_id: dealershipId,
                name,
                code:
                    typeof body.code === "string" && body.code.trim()
                        ? body.code.trim()
                        : null,
                address:
                    typeof body.address === "string" && body.address.trim()
                        ? body.address.trim()
                        : null,
                phone:
                    typeof body.phone === "string" && body.phone.trim()
                        ? body.phone.trim()
                        : null,
                email:
                    typeof body.email === "string" && body.email.trim()
                        ? body.email.trim()
                        : null,
                hours:
                    typeof body.hours === "string" && body.hours.trim()
                        ? body.hours.trim()
                        : null,
                is_active: body.is_active !== false,
                is_primary: isFirst,
                settings: {},
            })
            .select(SELECT_COLS)
            .single();

        if (error) throw error;

        return NextResponse.json(
            { data: shapeLocation(data as Record<string, unknown>) },
            { status: 201 }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating location:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}

/** PATCH update a location. Body: { id, name?, code?, address?, phone?, email?, hours?, is_active?, set_primary? } */
export async function PATCH(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        if (!canManageSettings(auth.profile)) {
            return NextResponse.json(
                { error: "Forbidden — Admin/Manager or settings:write required" },
                { status: 403 }
            );
        }

        const scope = tenantScopeFromRequest(tenant, req);
        requireWriteDealershipId(scope);

        const body = (await req.json()) as Record<string, unknown>;
        const id = typeof body.id === "string" ? body.id : null;
        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const { data: existing, error: loadErr } = await scopedTable(
            supabase,
            "locations",
            scope
        )
            .select(SELECT_COLS)
            .eq("id", id)
            .maybeSingle();
        if (loadErr) throw loadErr;
        if (!existing) {
            return NextResponse.json({ error: "Location not found" }, { status: 404 });
        }

        const patch: Record<string, unknown> = {};
        if (typeof body.name === "string") {
            const name = body.name.trim();
            if (!name) {
                return NextResponse.json(
                    { error: "Location name cannot be empty" },
                    { status: 400 }
                );
            }
            patch.name = name;
        }
        for (const field of ["code", "address", "phone", "email", "hours"] as const) {
            if (typeof body[field] === "string") {
                patch[field] = body[field].trim() || null;
            }
        }
        if (typeof body.is_active === "boolean") {
            patch.is_active = body.is_active;
        }

        const setPrimary = body.set_primary === true;
        if (setPrimary) {
            await applyTenantScope(
                supabase
                    .from("locations")
                    .update({ is_primary: false })
                    .eq("is_primary", true),
                scope,
                "locations"
            );
            patch.is_primary = true;
        }

        const { data, error } = await applyTenantScope(
            supabase
                .from("locations")
                .update(patch)
                .eq("id", id)
                .select(SELECT_COLS),
            scope,
            "locations"
        ).single();
        if (error) throw error;

        return NextResponse.json({
            data: shapeLocation(data as Record<string, unknown>),
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error updating location:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}

/** DELETE a location (records keep location_id NULL'd via ON DELETE SET NULL). */
export async function DELETE(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        if (!canManageSettings(auth.profile)) {
            return NextResponse.json(
                { error: "Forbidden — Admin/Manager or settings:write required" },
                { status: 403 }
            );
        }

        const scope = tenantScopeFromRequest(tenant, req);
        requireWriteDealershipId(scope);

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const { data: existing, error: loadErr } = await scopedTable(
            supabase,
            "locations",
            scope
        )
            .select("id, dealership_id")
            .eq("id", id)
            .maybeSingle();
        if (loadErr) throw loadErr;
        if (!existing) {
            return NextResponse.json({ error: "Location not found" }, { status: 404 });
        }

        const { error } = await applyTenantScope(
            supabase.from("locations").delete().eq("id", id),
            scope,
            "locations"
        );
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error deleting location:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}
