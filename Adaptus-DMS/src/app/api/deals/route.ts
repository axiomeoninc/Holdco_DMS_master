// app/api/deals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import {
    shouldScopeToAssigned,
    canViewAll,
    canCreate,
} from "@/src/lib/permission-middleware";
import { emitDealershipEvent } from "@/src/lib/api/webhooks";

// GET all deals
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        const userRole = currentUser.role;
        const userPermissions = currentUser.user_permissions || [];
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");
        const q = url.searchParams.get("q");
        const unlinked = url.searchParams.get("unlinked");
        // Multi-location (Tier 3): optional rooftop scope.
        const locationId = url.searchParams.get("location_id") || url.searchParams.get("locationId");

        let query = applyTenantScope(
            supabase
                .from("sales_deals")
                .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status, condition),
                customer:customers(id, name, email, phone),
                salesperson:users!sales_deals_salesperson_id_fkey(id, full_name, email, avatar)
            `, { count: "exact" })
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "sales_deals"
        );

        // Deal ↔ customer link queue: deals with no customer
        if (unlinked === "1" || unlinked === "true") {
            query = query.is("customer_id", null);
        }

        if (!isPlatformAdmin) {
            const scopedToAssigned = shouldScopeToAssigned(userRole, userPermissions);
            const viewAllDeals = canViewAll(userRole, userPermissions);

            if (scopedToAssigned || !viewAllDeals) {
                query = query.eq("salesperson_id", user.id);
            }
        }

        if (status) query = query.eq("deal_status", status);
        if (locationId) query = query.eq("location_id", locationId);
        if (q) {
            const { data: matchingCustomers } = await scopedTable(supabase, "customers", scope)
                .select("id")
                .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

            const customerIds = matchingCustomers?.map((c: { id: string }) => c.id) || [];

            const { data: matchingVehicles } = await scopedTable(supabase, "vehicles", scope)
                .select("id")
                .or(`make.ilike.%${q}%,model.ilike.%${q}%,vin.ilike.%${q}%,stock_number.ilike.%${q}%`);

            const vehicleIds = matchingVehicles?.map((v: { id: string }) => v.id) || [];

            query = query.or(
                `notes.ilike.%${q}%,deal_status.ilike.%${q}%,finance_company.ilike.%${q}%` +
                (customerIds.length > 0 ? `,customer_id.in.(${customerIds.join(',')})` : '') +
                (vehicleIds.length > 0 ? `,vehicle_id.in.(${vehicleIds.join(',')})` : '')
            );
        }

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        return NextResponse.json({ data: data || [], count: count || 0, limit, offset });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching deals:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create deal
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        // Check permission using centralized helper
        if (!canCreate(currentUser.role, currentUser.user_permissions || [], "deals", currentUser.is_platform_admin)) {
            return NextResponse.json({ error: "Forbidden - You cannot create deals" }, { status: 403 });
        }

        const payload = await req.json();

        const required = ["vehicle_id", "sale_price"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        const validStatuses = ['Open', 'Negotiation', 'Down Payment', 'Finance', 'Pending', 'Paid Off', 'Closed', 'Lost', 'Cancelled'];
        if (payload.deal_status && !validStatuses.includes(payload.deal_status)) {
            return NextResponse.json(
                { error: `Invalid deal_status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const dealData = {
            vehicle_id: payload.vehicle_id,
            customer_id: payload.customer_id || null,
            ...(typeof payload.location_id === "string" && payload.location_id.trim()
                ? { location_id: payload.location_id.trim() }
                : {}),
            deal_status: payload.deal_status || 'Negotiation',
            finance_term: payload.finance_term || null,
            interest_rate: payload.interest_rate || null,
            down_payment: payload.down_payment || 0,
            trade_in_value: payload.trade_in_value ?? 0,
            sale_price: payload.sale_price,
            salesperson_id: payload.salesperson_id || user.id,
            finance_company: payload.finance_company || null,
            notes: payload.notes || null,
            deal_date: payload.deal_date || new Date().toISOString().split('T')[0],
            dealership_id: requireWriteDealershipId(
                tenantScopeFromRequest(tenant, req)
            ),
            warranty_package: payload.warranty_package || null,
            gap_coverage: Boolean(payload.gap_coverage),
            tire_coverage: Boolean(payload.tire_coverage),
            paint_protection: Boolean(payload.paint_protection),
            extended_service: Boolean(payload.extended_service),
            admin_fee: payload.admin_fee ?? 0,
            financing_notes: payload.financing_notes || null,
            commission_rate: payload.commission_rate ?? null,
            commission_amount: payload.commission_amount ?? null,
        };

        const { data, error: dbError } = await supabase
            .from("sales_deals")
            .insert(dealData)
            .select(`
                *,
                vehicle:vehicles(id, vin, year, make, model, retail_price, image_gallery, status, condition),
                customer:customers(id, name, email, phone),
                salesperson:users!sales_deals_salesperson_id_fkey(id, full_name, email, avatar)
            `)
            .single();

        if (dbError) throw dbError;

        if (payload.deal_status === 'Paid Off' || payload.deal_status === 'Closed' || payload.close_deal) {
            await supabase
                .from("vehicles")
                .update({ status: 'Sold' })
                .eq("id", payload.vehicle_id);
        }

        // Webhook dispatch (fire-and-forget; failures never fail the write).
        if (currentUser.dealership_id) {
            void emitDealershipEvent({
                dealershipId: currentUser.dealership_id,
                event: "deal.created",
                payload: {
                    deal_id: data.id,
                    vehicle_id: data.vehicle_id,
                    customer_id: data.customer_id,
                    deal_status: data.deal_status,
                    sale_price: data.sale_price,
                    deal_date: data.deal_date,
                },
            }).catch((err: unknown) =>
                console.error("deal.created webhook dispatch failed:", err)
            );
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating deal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
