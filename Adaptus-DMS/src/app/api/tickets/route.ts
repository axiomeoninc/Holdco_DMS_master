// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// GET all tickets
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;
        const scope = tenantScopeFromRequest(tenant, req);

        const userRole = currentUser.role;
        const userPermissions = currentUser.user_permissions || [];

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");
        const priority = url.searchParams.get("priority");
        const assigned_to = url.searchParams.get("assigned_to");
        const q = url.searchParams.get("q");
        const createdAtFrom = url.searchParams.get("created_at_from");
        const createdAtTo = url.searchParams.get("created_at_to");

        let query = applyTenantScope(
            supabase
                .from("tickets")
                .select(`
                *,
                assigned_user:users!tickets_assigned_to_fkey(id, full_name, email, avatar),
                created_by_user:users!tickets_created_by_fkey(id, full_name)
            `, { count: "exact" })
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "tickets"
        );

        if (!isPlatformAdmin) {
            const scopedToAssigned = userRole === "Salesperson" || userRole === "Staff";
            const isAdminOrManager = userRole === "Admin" || userRole === "Manager";
            const viewAll = isAdminOrManager ||
                userPermissions.includes("*") ||
                (userPermissions.includes("tickets:read") && !userPermissions.includes("tickets:read:assigned"));

            if (scopedToAssigned || !viewAll) {
                query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
            }
        }

        if (status) query = query.eq("status", status);
        if (priority) query = query.eq("priority", priority);
        if (assigned_to && (currentUser.role === "Admin" || currentUser.role === "Manager" || isPlatformAdmin)) {
            query = query.eq("assigned_to", assigned_to);
        }
        if (createdAtFrom) query = query.gte("created_at", createdAtFrom);
        if (createdAtTo) query = query.lte("created_at", createdAtTo);
        if (q) {
            query = query.or(
                `subject.ilike.%${q}%,description.ilike.%${q}%`
            );
        }

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching tickets:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create ticket
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        // Check permission
        const canCreate = currentUser.is_platform_admin ||
            currentUser.role === "Admin" ||
            currentUser.role === "Manager" ||
            (currentUser.user_permissions || []).includes("tickets:write");

        if (!canCreate) {
            return NextResponse.json({ error: "Forbidden - You cannot create tickets" }, { status: 403 });
        }

        const payload = await req.json();

        if (!payload.subject) {
            return NextResponse.json(
                { error: "Subject is required" },
                { status: 400 }
            );
        }

        const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
        if (payload.status && !validStatuses.includes(payload.status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
        if (payload.priority && !validPriorities.includes(payload.priority)) {
            return NextResponse.json(
                { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
                { status: 400 }
            );
        }

        const ticketData = {
            subject: payload.subject,
            description: payload.description || null,
            assigned_to: payload.assigned_to || null,
            created_by: user.id,
            priority: payload.priority || 'Medium',
            status: payload.status || 'Open',
            resolved_at: payload.status === 'Resolved' ? new Date().toISOString() : null,
            dealership_id: requireWriteDealershipId(
                tenantScopeFromRequest(tenant, req)
            ),
        };

        const { data, error: dbError } = await supabase
            .from("tickets")
            .insert(ticketData)
            .select(`
                *,
                assigned_user:users!tickets_assigned_to_fkey(id, full_name, email, avatar),
                created_by_user:users!tickets_created_by_fkey(id, full_name)
            `)
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating ticket:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
