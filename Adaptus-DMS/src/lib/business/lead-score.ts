/**
 * Lead temperature scoring (Hot / Warm / Cold).
 * Pure helper — no I/O. Safe for client + unit tests.
 */

export type LeadTemperature = "Hot" | "Warm" | "Cold";

export interface LeadScoreInput {
    source?: string | null;
    status?: string | null;
    last_engagement?: string | null;
    lead_creation_date?: string | null;
    created_at?: string | null;
    interest_vehicle_id?: string | null;
    notes?: string | null;
    /** Optional override — days since last engagement (for tests). */
    nowMs?: number;
}

export interface LeadScoreResult {
    score: number;
    temperature: LeadTemperature;
    label: LeadTemperature;
}

const HOT_SOURCES = new Set([
    "walk-in",
    "walk in",
    "phone",
    "referral",
    "website",
    "web",
]);

const WARM_SOURCES = new Set([
    "facebook",
    "instagram",
    "kijiji",
    "autotrader",
    "marketplace",
    "email",
]);

function daysSince(iso: string | null | undefined, nowMs: number): number | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((nowMs - t) / (1000 * 60 * 60 * 24));
}

function sourceBoost(source: string | null | undefined): number {
    const key = (source || "").trim().toLowerCase();
    if (!key) return 0;
    if (HOT_SOURCES.has(key)) return 25;
    if (WARM_SOURCES.has(key)) return 15;
    return 5;
}

function statusBoost(status: string | null | undefined): number {
    const s = (status || "").trim().toLowerCase();
    switch (s) {
        case "qualified":
        case "hot":
        case "negotiation":
            return 30;
        case "contacted":
        case "working":
        case "in progress":
            return 20;
        case "new":
        case "open":
        case "not started":
            return 10;
        case "closed":
        case "won":
        case "sold":
            return 5;
        case "lost":
        case "dead":
        case "unqualified":
            return -20;
        default:
            return 0;
    }
}

/**
 * Score 0–100 → Hot (≥70), Warm (40–69), Cold (<40).
 */
export function scoreLead(input: LeadScoreInput): LeadScoreResult {
    const nowMs = input.nowMs ?? Date.now();
    let score = 35;

    score += sourceBoost(input.source);
    score += statusBoost(input.status);

    if (input.interest_vehicle_id) score += 15;
    if (input.notes && input.notes.trim().length > 20) score += 5;

    const engagedDays = daysSince(input.last_engagement, nowMs);
    if (engagedDays === null) {
        score -= 10;
    } else if (engagedDays <= 2) {
        score += 25;
    } else if (engagedDays <= 7) {
        score += 15;
    } else if (engagedDays <= 14) {
        score += 5;
    } else if (engagedDays <= 30) {
        score -= 10;
    } else {
        score -= 25;
    }

    const createdDays = daysSince(
        input.lead_creation_date || input.created_at,
        nowMs
    );
    if (createdDays !== null && createdDays <= 3) score += 10;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let temperature: LeadTemperature;
    if (score >= 70) temperature = "Hot";
    else if (score >= 40) temperature = "Warm";
    else temperature = "Cold";

    return { score, temperature, label: temperature };
}

/** Prefer persisted score/temperature (matches API filters); else compute. */
export function resolveLeadScore(lead: {
    score?: number | null;
    temperature?: string | null;
} & LeadScoreInput): LeadScoreResult {
    const storedTemp = lead.temperature;
    if (
        lead.score != null &&
        (storedTemp === "Hot" || storedTemp === "Warm" || storedTemp === "Cold")
    ) {
        return {
            score: lead.score,
            temperature: storedTemp,
            label: storedTemp,
        };
    }
    return scoreLead(lead);
}

export function temperatureClass(temp: LeadTemperature): string {
    switch (temp) {
        case "Hot":
            return "bg-red-50 text-red-700 border-red-200";
        case "Warm":
            return "bg-amber-50 text-amber-700 border-amber-200";
        case "Cold":
            return "bg-slate-100 text-slate-700 border-slate-200";
        default: {
            const _exhaustive: never = temp;
            return _exhaustive;
        }
    }
}

/** Deals stagnant when open stage and untouched longer than `days` (default 7). */
export function isDealStagnant(
    deal: { deal_status?: string | null; created_at?: string | null; deal_date?: string | null; updated_at?: string | null },
    days = 7,
    nowMs = Date.now()
): boolean {
    const status = (deal.deal_status || "").toLowerCase();
    if (status === "paid off" || status === "cancelled" || status === "closed") {
        return false;
    }
    const anchor = deal.updated_at || deal.created_at || deal.deal_date;
    if (!anchor) return false;
    const t = new Date(anchor).getTime();
    if (Number.isNaN(t)) return false;
    return nowMs - t > days * 24 * 60 * 60 * 1000;
}

/** Inventory aging bucket from days in stock. */
export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export function agingBucket(daysInStock: number): AgingBucket {
    if (daysInStock <= 30) return "0-30";
    if (daysInStock <= 60) return "31-60";
    if (daysInStock <= 90) return "61-90";
    return "90+";
}

export function daysBetween(iso: string | null | undefined, nowMs = Date.now()): number {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.max(0, Math.floor((nowMs - t) / (1000 * 60 * 60 * 24)));
}
