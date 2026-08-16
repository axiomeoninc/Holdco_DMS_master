// app/api/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { applyConsentTimestamps } from "@/src/lib/customer-consent";
import { pickAllowed, requireTenantClient } from "@/src/lib/auth-helpers";
import { clientIp } from "@/src/lib/trial";
import {
    applyTenantScope,
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// Consent timestamps / IPs are server-stamped via applyConsentTimestamps — never client-writable.
const CUSTOMER_CREATE_FIELDS = [
    "name", "email", "phone", "address", "city", "province", "postal_code",
    "status", "source", "notes", "company", "assigned_to",
    "marketing_consent", "sms_consent",
] as const;

// GET all customers (filtered by dealership + scoping for Salesperson/Staff)
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
        // Support both old (limit/offset) and new (page/perPage/pageSize) pagination.
        // Only treat as "new-style" when page/perPage/pageSize params are present —
        // otherwise ?limit=1000 was being silently capped to 50.
        const pageParam = url.searchParams.get("page");
        const perPageParam = url.searchParams.get("perPage") || url.searchParams.get("pageSize");
        let limit: number;
        let offset: number;
        if (pageParam !== null || perPageParam !== null) {
            const page = parseInt(pageParam || "1") || 1;
            const perPage = parseInt(perPageParam || "50") || 50;
            offset = (page - 1) * perPage;
            limit = perPage;
        } else {
            limit = parseInt(url.searchParams.get("limit") || "50") || 50;
            offset = parseInt(url.searchParams.get("offset") || "0") || 0;
        }
        const q = url.searchParams.get("q") || url.searchParams.get("search");
        const status = url.searchParams.get("status");
        const source = url.searchParams.get("source");
        const assignedTo = url.searchParams.get("assigned_to");
        const distinctStatus = url.searchParams.get("distinct_status");

        // sort support
        const sortField = url.searchParams.get("sort") || url.searchParams.get("sortBy") || "created_at";
        const sortDir = url.searchParams.get("sortDir") || "desc";
        const isDesc = sortDir.toLowerCase() === "desc";
        const cleanSortField = sortField.replace(/^-/, "");

        // If requesting distinct status values, return them from database
        if (distinctStatus === "true") {
            const statusQuery = applyTenantScope(
                supabase
                    .from("customers")
                    .select("status")
                    .not("status", "is", null),
                scope,
                "customers"
            );

            const { data, error: dbError } = await statusQuery;
            if (dbError) throw dbError;

            const uniqueStatuses = [...new Set(data?.map((c) => c.status).filter(Boolean) || [])];
            return NextResponse.json({ data: uniqueStatuses });
        }

        let query = applyTenantScope(
            supabase
                .from("customers")
                .select("*", { count: "exact" })
                .order(cleanSortField, { ascending: !isDesc })
                .range(offset, offset + limit - 1),
            scope,
            "customers"
        );

        if (!isPlatformAdmin) {
            const isAdminOrManager = userRole === "Admin" || userRole === "Manager";
            const scopedToAssigned = userRole === "Salesperson" || userRole === "Staff";
            const viewAll = userPermissions.includes("*") ||
                isAdminOrManager ||
                (userPermissions.includes("customers:read") && !userPermissions.includes("customers:read:assigned"));

            if (scopedToAssigned || !viewAll) {
                query = query.eq("assigned_to", user.id);
            }
        }

        if (status) query = query.eq("status", status);
        if (source) query = query.eq("source", source);
        if (assignedTo) query = query.eq("assigned_to", assignedTo);
        if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%,notes.ilike.%${q}%`);

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
        console.error("Error fetching customers:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create customer (within user's dealership)
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        // Check permission - ALL roles can create customers (Admin, Manager, Salesperson, Staff)
        // Only platform admin outside a dealership context cannot create
        const canCreate = currentUser.is_platform_admin ||
            currentUser.role === "Admin" ||
            currentUser.role === "Manager" ||
            currentUser.role === "Salesperson" ||
            currentUser.role === "Staff" ||
            (currentUser.user_permissions || []).includes("customers:write");

        if (!canCreate) {
            return NextResponse.json({ error: "Forbidden - You cannot create customers" }, { status: 403 });
        }

        const writeScope = tenantScopeFromRequest(tenant, req);

        const payload = await req.json();

        const required = ["name"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        if (payload.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(payload.email)) {
                return NextResponse.json(
                    { error: "Invalid email format" },
                    { status: 400 }
                );
            }
        }

        // Auto-assign created customer to the creating user (for Salesperson/Staff)
        const userRole = currentUser.role;
        const userPermissions = currentUser.user_permissions || [];
        const isScoped = userRole === "Salesperson" || userRole === "Staff" ||
            userPermissions.includes("customers:read:assigned");

        const safe = pickAllowed(payload, CUSTOMER_CREATE_FIELDS) as Record<string, unknown>;
        const stamped = applyConsentTimestamps(
            {
                ...safe,
                marketing_consent: Boolean(safe.marketing_consent),
                sms_consent: Boolean(safe.sms_consent),
            },
            null,
            { ip: clientIp(req) }
        );

        const customerData: Record<string, unknown> = {
            ...stamped,
            dealership_id: requireWriteDealershipId(writeScope),
        };

        // If user is scoped to assigned only, auto-assign the customer to them
        if (isScoped && !payload.assigned_to) {
            customerData.assigned_to = user.id;
        }

        let { data, error: dbError } = await supabase
            .from("customers")
            .insert(customerData)
            .select()
            .single();

        if (dbError && /marketing_consent_ip|sms_consent_ip|column/i.test(dbError.message || "")) {
            const { marketing_consent_ip: _m, sms_consent_ip: _s, ...withoutIp } = customerData;
            const retry = await supabase.from("customers").insert(withoutIp).select().single();
            data = retry.data;
            dbError = retry.error;
        }

        if (dbError) throw dbError;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating customer:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
