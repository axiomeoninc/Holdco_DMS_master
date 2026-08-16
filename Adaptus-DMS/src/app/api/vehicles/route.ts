// app/api/vehicles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pickAllowed, requireTenantClient } from "@/src/lib/auth-helpers";
import { VEHICLE_ALLOWED_FIELDS } from "@/src/lib/vehicle-fields";
import { assertDamageDisclosureForPublish } from "@/src/lib/mvda-damage";
import {
    applyTenantScope,
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";


// GET all vehicles (filtered by dealership)
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        // Vehicles are queried with the service-role client to bypass RLS — the
        // user's RLS-filtered token returns 0 rows because the dealership_id
        // mapping on auth.users isn't always present in the JWT. We still
        // scope the query to the bound rooftop at the application layer
        // (defense in depth). Platform without a picker gets the empty
        // sentinel — never a mixed-tenant dump.

        const url = new URL(req.url);
        // Support both old (limit/offset) and new (page/perPage/pageSize) pagination.
        // IMPORTANT: only treat it as "new-style" when page/perPage/pageSize params are
        // actually present — otherwise ?limit=1000 was being silently capped to 50.
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
        const status = url.searchParams.get("status");
        const make = url.searchParams.get("make");
        const model = url.searchParams.get("model");
        const q = url.searchParams.get("q") || url.searchParams.get("search");
        const vin = url.searchParams.get("vin"); // exact VIN match (used by /inventory/[vin] page)
        const minYear = url.searchParams.get("minYear") || url.searchParams.get("year_min");
        const maxYear = url.searchParams.get("maxYear") || url.searchParams.get("year_max");
        const minPrice = url.searchParams.get("minPrice") || url.searchParams.get("price_min");
        const maxPrice = url.searchParams.get("maxPrice") || url.searchParams.get("price_max");
        const condition = url.searchParams.get("condition");
        const minDays = url.searchParams.get("minDays") || url.searchParams.get("days_min");
        const maxDays = url.searchParams.get("maxDays") || url.searchParams.get("days_max");
        // Multi-location (Tier 3): optional rooftop scope.
        const locationId = url.searchParams.get("location_id") || url.searchParams.get("locationId");
        // sort=year or sort=-year or sortBy=year&sortDir=desc
        // days → created_at (older = more days in stock); retail → retail_price; cost → purchase_price
        const sortFieldRaw = url.searchParams.get("sort") || url.searchParams.get("sortBy") || "created_at";
        const sortDir = url.searchParams.get("sortDir") || (url.searchParams.get("sort")?.startsWith("-") ? "desc" : "desc");
        const isDesc = sortDir.toLowerCase() === "desc";
        let cleanSortField = sortFieldRaw.replace(/^-/, "");
        const daysSort =
            cleanSortField === "days" || cleanSortField === "days_in_stock";
        if (daysSort) {
            cleanSortField = "created_at";
        } else if (cleanSortField === "retail" || cleanSortField === "price") {
            cleanSortField = "retail_price";
        } else if (cleanSortField === "cost") {
            cleanSortField = "purchase_price";
        }
        // Whitelist — unknown columns previously 500'd PostgREST ("column does not exist").
        const ALLOWED_SORT = new Set([
            "created_at",
            "updated_at",
            "year",
            "make",
            "model",
            "vin",
            "stock_number",
            "status",
            "condition",
            "odometer",
            "retail_price",
            "purchase_price",
        ]);
        if (!ALLOWED_SORT.has(cleanSortField)) {
            cleanSortField = "created_at";
        }
        // Days ascending = newest first (fewer days); Days desc = oldest first
        const orderAsc = daysSort ? isDesc : !isDesc;

        let query = applyTenantScope(
            supabase
                .from("vehicles")
                .select("*", { count: "exact" })
                .order(cleanSortField, { ascending: orderAsc })
                .range(offset, offset + limit - 1),
            scope,
            "vehicles"
        );

        if (vin) query = query.eq("vin", vin);
        if (status) query = query.eq("status", status);
        if (make) query = query.ilike("make", `%${make}%`);
        if (model) query = query.ilike("model", `%${model}%`);
        if (condition) query = query.eq("condition", condition);
        if (minYear) query = query.gte("year", parseInt(minYear));
        if (maxYear) query = query.lte("year", parseInt(maxYear));
        if (minPrice) query = query.gte("retail_price", parseFloat(minPrice));
        if (maxPrice) query = query.lte("retail_price", parseFloat(maxPrice));
        // Aging: created_at on or before (now - N days)
        if (minDays) {
            const ms = parseInt(minDays, 10) * 86_400_000;
            if (!Number.isNaN(ms) && ms > 0) {
                query = query.lte("created_at", new Date(Date.now() - ms).toISOString());
            }
        }
        if (maxDays) {
            const ms = parseInt(maxDays, 10) * 86_400_000;
            if (!Number.isNaN(ms) && ms >= 0) {
                query = query.gte("created_at", new Date(Date.now() - ms).toISOString());
            }
        }
        if (locationId) query = query.eq("location_id", locationId);
        if (q) query = query.or(`vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,trim.ilike.%${q}%,stock_number.ilike.%${q}%,description.ilike.%${q}%`);

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
        console.error("Error fetching vehicles:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create vehicle (within user's dealership)
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const payload = await req.json();
        const required = ["vin", "year", "make", "model", "purchase_price", "retail_price", "condition"];

        for (const field of required) {
            if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        const safePayload = pickAllowed(payload, VEHICLE_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        // Normalize features: accept comma-string or array
        if (typeof (safePayload as { features?: unknown }).features === "string") {
            const raw = (safePayload as { features: string }).features;
            (safePayload as { features: string[] }).features = raw
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean);
        }

        try {
            assertDamageDisclosureForPublish({
                status: (safePayload as { status?: string }).status,
                known_damage: (safePayload as { known_damage?: boolean }).known_damage,
                disclosure: (safePayload as { disclosure?: string }).disclosure,
            });
        } catch (e) {
            return NextResponse.json(
                { error: e instanceof Error ? e.message : "Disclosure required" },
                { status: 400 }
            );
        }

        // Stamp the bound rooftop — never the caller's possibly-null home id.
        const { data, error: dbError } = await supabase
            .from("vehicles")
            .insert({ ...safePayload, dealership_id: requireWriteDealershipId(scope) })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return NextResponse.json(
                    { error: "A vehicle with this VIN already exists at this dealership" },
                    { status: 400 }
                );
            }
            if (dbError.code === "23514" || dbError.code === "23502") {
                return NextResponse.json(
                    { error: dbError.message || "Invalid vehicle data" },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: dbError.message || "Failed to create vehicle" },
                { status: 500 }
            );
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating vehicle:", error);
        const message =
            error instanceof Error
                ? error.message
                : typeof error === "object" &&
                    error !== null &&
                    "message" in error &&
                    typeof (error as { message: unknown }).message === "string"
                  ? (error as { message: string }).message
                  : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}