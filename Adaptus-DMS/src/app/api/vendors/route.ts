// app/api/vendors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

// GET all vendors
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const q = url.searchParams.get("q");
        const vendorType = url.searchParams.get("vendor_type");
        const createdAtFrom = url.searchParams.get("created_at_from");
        const createdAtTo = url.searchParams.get("created_at_to");

        let query = applyTenantScope(
            supabase
                .from("vendors")
                .select("*", { count: "exact" })
                .order("vendor_name", { ascending: true })
                .range(offset, offset + limit - 1),
            scope,
            "vendors"
        );

        if (q) {
            query = query.or(
                `vendor_name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%`
            );
        }
        if (vendorType) {
            // Hillz/import rows may store vendor_type in different casing
            query = query.ilike("vendor_type", vendorType);
        }
        // Inclusive calendar-day bounds for timestamptz created_at
        if (createdAtFrom) {
            const fromIso = createdAtFrom.includes("T")
                ? createdAtFrom
                : `${createdAtFrom}T00:00:00.000Z`;
            query = query.gte("created_at", fromIso);
        }
        if (createdAtTo) {
            const toIso = createdAtTo.includes("T")
                ? createdAtTo
                : `${createdAtTo}T23:59:59.999Z`;
            query = query.lte("created_at", toIso);
        }

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        // Aggregate type/phone totals across the filtered set (not just the page).
        let totalsQuery = applyTenantScope(
            supabase.from("vendors").select("vendor_type, phone"),
            scope,
            "vendors"
        );
        if (q) {
            totalsQuery = totalsQuery.or(
                `vendor_name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%`
            );
        }
        if (vendorType) totalsQuery = totalsQuery.ilike("vendor_type", vendorType);
        if (createdAtFrom) {
            const fromIso = createdAtFrom.includes("T")
                ? createdAtFrom
                : `${createdAtFrom}T00:00:00.000Z`;
            totalsQuery = totalsQuery.gte("created_at", fromIso);
        }
        if (createdAtTo) {
            const toIso = createdAtTo.includes("T")
                ? createdAtTo
                : `${createdAtTo}T23:59:59.999Z`;
            totalsQuery = totalsQuery.lte("created_at", toIso);
        }

        const { data: totalsRows } = await totalsQuery;
        let dealerCount = 0;
        let financeCount = 0;
        let withPhoneCount = 0;
        for (const row of totalsRows || []) {
            const t = String(row.vendor_type || "").toLowerCase();
            if (t === "dealer") dealerCount += 1;
            if (t === "finance") financeCount += 1;
            if (row.phone) withPhoneCount += 1;
        }

        return NextResponse.json({
            data: data || [],
            count: count || 0,
            limit,
            offset,
            totals: {
                dealerCount,
                financeCount,
                withPhoneCount,
            },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching vendors:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create vendor
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        if (!currentUser.dealership_id && !currentUser.is_platform_admin) {
            return NextResponse.json(
                { error: "Unauthorized - No dealership context" },
                { status: 403 }
            );
        }

        const payload = await req.json();

        if (!payload.vendor_name) {
            return NextResponse.json(
                { error: "Vendor name is required" },
                { status: 400 }
            );
        }

        const { data, error: dbError } = await supabase
            .from("vendors")
            .insert({
                vendor_type: payload.vendor_type || 'General',
                vendor_name: payload.vendor_name,
                address: payload.address || null,
                phone: payload.phone || null,
                gst_number: payload.gst_number || null,
                hst_number: payload.hst_number || null,
                pst_number: payload.pst_number || null,
                city: payload.city || null,
                province: payload.province || null,
                postal_code: payload.postal_code || null,
                contact_name: payload.contact_name || null,
                contact_email: payload.contact_email || null,
                contact_phone: payload.contact_phone || null,
                notes: payload.notes || null,
                dealership_id: requireWriteDealershipId(
                    tenantScopeFromRequest(tenant, req)
                ),
            })
            .select()
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating vendor:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
