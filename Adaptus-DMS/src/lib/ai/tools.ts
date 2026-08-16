/**
 * Dealership-scoped tools for Desk Copilot.
 * Never cross tenant boundaries — always filter by dealership_id.
 */

import type { UserProfile } from "@/src/lib/auth-helpers";
import type { LlmToolDef } from "@/src/lib/ai/llm";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

export const COPILOT_TOOL_DEFS: LlmToolDef[] = [
    {
        type: "function",
        function: {
            name: "search_vehicles",
            description:
                "Search dealership inventory by make/model/status/price/aging. Does not invent prices or floor values.",
            parameters: {
                type: "object",
                properties: {
                    q: { type: "string", description: "Free-text VIN/make/model/stock" },
                    make: { type: "string" },
                    model: { type: "string" },
                    status: { type: "string" },
                    max_price: { type: "number" },
                    min_days_in_stock: { type: "number" },
                    limit: { type: "number" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_lead",
            description: "Fetch a lead by id (dealership-scoped) with customer basics.",
            parameters: {
                type: "object",
                properties: {
                    lead_id: { type: "string" },
                },
                required: ["lead_id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "summarize_deal",
            description: "Fetch deal summary by id for the caller's dealership.",
            parameters: {
                type: "object",
                properties: {
                    deal_id: { type: "string" },
                },
                required: ["deal_id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_aging_units",
            description: "List active inventory aged beyond min_days (default 60).",
            parameters: {
                type: "object",
                properties: {
                    min_days: { type: "number" },
                    limit: { type: "number" },
                },
            },
        },
    },
];

function daysInStock(createdAt: string | null | undefined): number {
    if (!createdAt) return 0;
    const ms = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function requireDealershipId(
    profile: UserProfile,
    rooftopId?: string | null
): string {
    const id = rooftopId || profile.dealership_id;
    if (!id) {
        throw new Error("No dealership context for AI tools");
    }
    return id;
}

export async function runCopilotTool(
    profile: UserProfile,
    name: string,
    argsJson: string,
    rooftopId?: string | null
): Promise<unknown> {
    const dealershipId = requireDealershipId(profile, rooftopId);
    let args: Record<string, unknown> = {};
    try {
        args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    } catch {
        args = {};
    }

    switch (name) {
        case "search_vehicles":
            return searchVehicles(dealershipId, args);
        case "get_lead":
            return getLead(dealershipId, String(args.lead_id ?? ""));
        case "summarize_deal":
            return summarizeDeal(dealershipId, String(args.deal_id ?? ""));
        case "list_aging_units":
            return listAgingUnits(dealershipId, args);
        default:
            return { error: `Unknown tool: ${name}` };
    }
}

async function searchVehicles(
    dealershipId: string,
    args: Record<string, unknown>
) {
    const limit = Math.min(Number(args.limit) || 8, 20);
    let query = supabaseAdmin
        .from("vehicles")
        .select(
            "id, vin, year, make, model, trim, stock_number, status, retail_price, special_price, odometer, created_at, condition"
        )
        .eq("dealership_id", dealershipId)
        .limit(40);

    if (typeof args.status === "string" && args.status.trim()) {
        query = query.ilike("status", args.status.trim());
    }
    if (typeof args.make === "string" && args.make.trim()) {
        query = query.ilike("make", `%${args.make.trim()}%`);
    }
    if (typeof args.model === "string" && args.model.trim()) {
        query = query.ilike("model", `%${args.model.trim()}%`);
    }
    if (typeof args.max_price === "number" && Number.isFinite(args.max_price)) {
        query = query.lte("retail_price", args.max_price);
    }
    if (typeof args.q === "string" && args.q.trim()) {
        const q = args.q.trim().replace(/%/g, "");
        query = query.or(
            `vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,stock_number.ilike.%${q}%`
        );
    }

    const { data, error } = await query;
    if (error) throw error;

    const minDays =
        typeof args.min_days_in_stock === "number" ? args.min_days_in_stock : null;
    let rows = (data ?? []).map((v) => ({
        ...v,
        days_in_stock: daysInStock(v.created_at),
        // Explicit: floors/cost are not exposed to the model for safety
        floor_price: null as null,
        note: "Retail/special only — do not invent floors or costs.",
    }));
    if (minDays != null) {
        rows = rows.filter((r) => r.days_in_stock >= minDays);
    }
    return { vehicles: rows.slice(0, limit) };
}

async function getLead(dealershipId: string, leadId: string) {
    if (!leadId) return { error: "lead_id required" };
    const { data, error } = await supabaseAdmin
        .from("leads")
        .select(
            `id, status, source, notes, temperature, score, created_at, dealership_id,
             customer:customers(id, name, first_name, last_name, email, phone),
             interest_vehicle:vehicles(id, year, make, model, stock_number, retail_price)`
        )
        .eq("id", leadId)
        .eq("dealership_id", dealershipId)
        .maybeSingle();
    if (error) throw error;
    if (!data) return { error: "Lead not found" };
    return { lead: data };
}

async function summarizeDeal(dealershipId: string, dealId: string) {
    if (!dealId) return { error: "deal_id required" };
    const { data, error } = await supabaseAdmin
        .from("sales_deals")
        .select(
            `id, deal_number, status, deal_status, sale_price, down_payment, finance_amount,
             trade_in_value, notes, deal_date, dealership_id,
             vehicle:vehicles(id, year, make, model, vin, stock_number, retail_price),
             customer:customers(id, name, email, phone)`
        )
        .eq("id", dealId)
        .eq("dealership_id", dealershipId)
        .maybeSingle();
    if (error) throw error;
    if (!data) return { error: "Deal not found" };
    return { deal: data };
}

async function listAgingUnits(
    dealershipId: string,
    args: Record<string, unknown>
) {
    const minDays = typeof args.min_days === "number" ? args.min_days : 60;
    const limit = Math.min(Number(args.limit) || 12, 25);
    const { data, error } = await supabaseAdmin
        .from("vehicles")
        .select(
            "id, vin, year, make, model, stock_number, status, retail_price, special_price, created_at"
        )
        .eq("dealership_id", dealershipId)
        .ilike("status", "Active")
        .order("created_at", { ascending: true })
        .limit(80);
    if (error) throw error;
    const aged = (data ?? [])
        .map((v) => ({
            ...v,
            days_in_stock: daysInStock(v.created_at),
        }))
        .filter((v) => v.days_in_stock >= minDays)
        .slice(0, limit);
    return { min_days: minDays, vehicles: aged };
}
