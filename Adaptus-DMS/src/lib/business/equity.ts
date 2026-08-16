/**
 * Trade-in / equity position triggers for aging inventory and CRM records.
 *
 * Pure helper — no I/O. Safe for client + unit tests.
 */

export const EQUITY_CANDIDATE_DAYS = 45;

export type EquityClass = "positive" | "break_even" | "negative";

export interface VehicleLike {
    id?: string;
    vin?: string | null;
    status?: string | null;
    retail_price?: number | null;
    created_at?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    stock_number?: string | null;
}

export interface DealLike {
    id?: string;
    trade_in_value?: number | null;
    trade_in_payoff?: number | null;
    deal_status?: string | null;
    customer_id?: string | null;
    created_at?: string | null;
}

/** Equity position = trade value − payoff (negative means a deficit). */
export function computeEquity(
    tradeValue: number | null | undefined,
    payoff: number | null | undefined
): number | null {
    if (tradeValue === null || tradeValue === undefined) return null;
    const value = Number(tradeValue) || 0;
    const owed = Number(payoff) || 0;
    return value - owed;
}

export function equityClass(equity: number | null | undefined): EquityClass {
    if (equity === null || equity === undefined) return "break_even";
    if (equity > 100) return "positive";
    if (equity < -100) return "negative";
    return "break_even";
}

export function equityLabel(equity: number | null | undefined): string {
    switch (equityClass(equity)) {
        case "positive":
            return "Positive equity";
        case "negative":
            return "Negative equity";
        default:
            return "Break-even";
    }
}

function daysInStock(createdAt: string | null | undefined, nowMs: number): number {
    if (!createdAt) return 0;
    const ms = new Date(createdAt).getTime();
    if (Number.isNaN(ms)) return 0;
    return Math.max(0, Math.floor((nowMs - ms) / 86_400_000));
}

export interface InventoryEquityCandidate extends VehicleLike {
    days_in_stock: number;
    /** Retail value still on the lot for an aging unit. */
    equity_hint: number | null;
}

/**
 * Inventory equity candidates: active units aged ≥ threshold that still carry
 * retail value. Aging stock is locked-up equity — a fresh deal on these units
 * is the fastest way to convert it.
 */
export function inventoryEquityCandidates(
    vehicles: VehicleLike[],
    opts: { minDays?: number; nowMs?: number } = {}
): InventoryEquityCandidate[] {
    const nowMs = opts.nowMs ?? Date.now();
    const minDays = opts.minDays ?? EQUITY_CANDIDATE_DAYS;
    return (vehicles || [])
        .map((v) => {
            const days = daysInStock(v.created_at, nowMs);
            return {
                ...v,
                days_in_stock: days,
                equity_hint: v.retail_price != null ? Number(v.retail_price) || null : null,
            };
        })
        .filter(
            (v) =>
                daysInStock(v.created_at, nowMs) >= minDays &&
                (!v.status || v.status === "Active") &&
                v.equity_hint !== null &&
                v.equity_hint > 0
        )
        .sort((a, b) => b.days_in_stock - a.days_in_stock);
}

/** Human trigger line, e.g. "2 units > 45 days, equity candidate". */
export function inventoryEquityTriggerText(count: number, minDays?: number): string {
    const days = minDays ?? EQUITY_CANDIDATE_DAYS;
    if (count === 0) return "No equity candidates";
    return `${count} unit${count === 1 ? "" : "s"} > ${days} days, equity candidate`;
}

export interface CustomerEquityTrigger {
    customer_id: string;
    customer_name: string | null;
    deal_id: string;
    trade_value: number;
    payoff: number | null;
    equity: number;
    class: EquityClass;
    deal_status: string | null;
}

/**
 * CRM equity triggers: customers whose most recent deal included a trade-in.
 * A trade-in deal means the customer has an equity position that a follow-up
 * sale can build on (or a negative position worth surfacing before they ask).
 */
export function crmEquityTriggers(
    deals: Array<
        DealLike & {
            // Supabase returns to-one relations as a 0/1-element array unless
            // `.single()` is used, so accept both shapes here.
            customer?:
                | { id: string; name: string | null }
                | Array<{ id: string; name: string | null }>
                | null;
        }
    >
): CustomerEquityTrigger[] {
    const latestByCustomer = new Map<
        string,
        (typeof deals)[number]
    >();
    for (const deal of deals || []) {
        if (!deal.customer_id) continue;
        const existing = latestByCustomer.get(deal.customer_id);
        if (!existing || new Date(deal.created_at || 0) > new Date(existing.created_at || 0)) {
            latestByCustomer.set(deal.customer_id, deal);
        }
    }
    const triggers: CustomerEquityTrigger[] = [];
    for (const deal of latestByCustomer.values()) {
        const tradeValue = Number(deal.trade_in_value) || 0;
        if (tradeValue <= 0) continue;
        const payoff = deal.trade_in_payoff != null ? Number(deal.trade_in_payoff) || 0 : null;
        const equity = computeEquity(tradeValue, payoff) ?? tradeValue;
        const customer = Array.isArray(deal.customer) ? deal.customer[0] : deal.customer;
        triggers.push({
            customer_id: deal.customer_id!,
            customer_name: customer?.name ?? null,
            deal_id: deal.id || "",
            trade_value: tradeValue,
            payoff,
            equity,
            class: equityClass(equity),
            deal_status: deal.deal_status ?? null,
        });
    }
    return triggers.sort((a, b) => b.equity - a.equity);
}
