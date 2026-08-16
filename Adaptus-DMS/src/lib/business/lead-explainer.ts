/**
 * Explainable lead scoring.
 *
 * The deterministic math stays in `lead-score.ts` (scoreLead). This module
 * derives a small, factual signal list from the SAME inputs so the LLM is
 * only ever asked to paraphrase signals we already computed — never to invent
 * engagement facts. Explanations reference signals by `[S#]` tokens; anything
 * else is stripped before persisting/displaying (anti-hallucination guard).
 *
 * Pure helper — no I/O. Safe for client + unit tests.
 */

export interface LeadSignal {
    /** Stable token the model must cite, e.g. "S1". */
    key: string;
    id: string;
    label: string;
    detail: string;
    /** True when the signal raises the score. */
    positive: boolean;
    /** Optional numeric magnitude shown in the UI breakdown. */
    score_impact?: number;
}

export interface LeadExplanationInput {
    source?: string | null;
    status?: string | null;
    last_engagement?: string | null;
    lead_creation_date?: string | null;
    created_at?: string | null;
    interest_vehicle_id?: string | null;
    notes?: string | null;
    /** Engagement facts that may be present on richer lead sources. */
    vdp_views?: number | null;
    emails_opened?: number | null;
    bdc_attempts?: number | null;
    nowMs?: number;
}

function daysSince(iso: string | null | undefined, nowMs: number): number | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((nowMs - t) / (1000 * 60 * 60 * 24)));
}

/**
 * Deterministically enumerate the signals that drove the score.
 * Mirrors the rules in `lead-score.ts` so UI + LLM share one source of truth.
 */
export function extractLeadSignals(
    input: LeadExplanationInput
): LeadSignal[] {
    const nowMs = input.nowMs ?? Date.now();
    const signals: LeadSignal[] = [];
    let idx = 0;
    const push = (
        id: string,
        label: string,
        detail: string,
        positive: boolean,
        score_impact?: number
    ) => {
        idx += 1;
        signals.push({
            key: `S${idx}`,
            id,
            label,
            detail,
            positive,
            score_impact,
        });
    };

    const source = (input.source || "").trim().toLowerCase();
    if (source) {
        const hot =
            source === "walk-in" || source === "walk in" || source === "phone" ||
            source === "referral" || source === "website" || source === "web";
        const warm =
            source === "facebook" || source === "instagram" || source === "kijiji" ||
            source === "autotrader" || source === "marketplace" || source === "email";
        const boost = hot ? 25 : warm ? 15 : 5;
        push(
            "source",
            `Source is ${input.source}`,
            hot
                ? "High-intent source (walk-in/phone/referral/website)."
                : warm
                  ? "Marketplace/social source with moderate intent."
                  : "Generic source — low direct signal.",
            hot || warm,
            boost
        );
    }

    const status = (input.status || "").trim().toLowerCase();
    if (status) {
        const map: Record<string, number> = {
            qualified: 30,
            hot: 30,
            negotiation: 30,
            contacted: 20,
            working: 20,
            "in progress": 20,
            new: 10,
            open: 10,
            "not started": 10,
            closed: 5,
            won: 5,
            sold: 5,
            lost: -20,
            dead: -20,
            unqualified: -20,
        };
        const boost = map[status] ?? 0;
        push(
            "status",
            `Status is ${input.status}`,
            boost >= 20
                ? "Working/qualified stage — actively progressing."
                : boost >= 10
                  ? "Fresh lead, not yet worked."
                  : boost < 0
                    ? "Lost/dead stage — deprioritized."
                    : "Neutral stage.",
            boost > 0,
            boost
        );
    }

    if (input.interest_vehicle_id) {
        push(
            "vehicle",
            "Interested in a specific vehicle",
            "Lead referenced a specific unit — concrete purchase intent.",
            true,
            15
        );
    }

    if (input.notes && input.notes.trim().length > 20) {
        push(
            "notes",
            "Detailed notes on file",
            "Notes contain context (vehicle, budget, timing).",
            true,
            5
        );
    }

    if (typeof input.vdp_views === "number" && input.vdp_views > 0) {
        push(
            "vdp_views",
            `${input.vdp_views} VDP view${input.vdp_views === 1 ? "" : "s"}`,
            "Repeat looks at a vehicle detail page signal active shopping.",
            true
        );
    }
    if (typeof input.emails_opened === "number" && input.emails_opened > 0) {
        push(
            "emails_opened",
            `${input.emails_opened} email${input.emails_opened === 1 ? "" : "s"} opened`,
            "Engagement with outreach indicates interest.",
            true
        );
    }
    if (typeof input.bdc_attempts === "number" && input.bdc_attempts > 0) {
        push(
            "bdc_attempts",
            `${input.bdc_attempts} BDC attempt${input.bdc_attempts === 1 ? "" : "s"} without reply`,
            "Multiple unanswered outreach attempts — needs a different angle (often a quote).",
            false
        );
    }

    const engagedDays = daysSince(input.last_engagement, nowMs);
    if (engagedDays === null) {
        push(
            "engagement",
            "No recorded engagement",
            "Missing last-engagement date — treated as stale.",
            false,
            -10
        );
    } else if (engagedDays <= 2) {
        push(
            "engagement",
            `Engaged ${engagedDays <= 0 ? "today" : `${engagedDays}d ago`}`,
            "Very recent engagement — respond fast.",
            true,
            25
        );
    } else if (engagedDays <= 7) {
        push(
            "engagement",
            `Engaged ${engagedDays}d ago`,
            "Engaged within a week — still warm.",
            true,
            15
        );
    } else if (engagedDays <= 14) {
        push(
            "engagement",
            `Engaged ${engagedDays}d ago`,
            "Engaged within two weeks — moderately warm.",
            true,
            5
        );
    } else if (engagedDays <= 30) {
        push(
            "engagement",
            `Engaged ${engagedDays}d ago`,
            "Silent for weeks — cooling.",
            false,
            -10
        );
    } else {
        push(
            "engagement",
            `Engaged ${engagedDays}d ago`,
            "Long silence — re-engagement needed.",
            false,
            -25
        );
    }

    const createdDays = daysSince(
        input.lead_creation_date || input.created_at,
        nowMs
    );
    if (createdDays !== null && createdDays <= 3) {
        push(
            "recency",
            `Created ${createdDays === 0 ? "today" : `${createdDays}d ago`}`,
            "Fresh lead — speed to first contact matters.",
            true,
            10
        );
    }

    return signals;
}

/** Numbered facts block fed to the model. */
export function signalFactsText(signals: LeadSignal[]): string {
    if (signals.length === 0) return "(no signals computed)";
    return signals
        .map((s) => `[${s.key}] ${s.label}: ${s.detail}`)
        .join("\n");
}

const SIGNAL_TOKEN_RE = /\[S\d+\]/g;

/**
 * Anti-hallucination guard: only `[S#]` tokens from the provided signal list
 * are allowed. Unknown tokens are stripped; the text is rejected if it ends
 * up empty or if it makes no reference to any signal at all.
 */
export function sanitizeExplanation(
    text: string,
    signals: LeadSignal[]
): { ok: true; text: string } | { ok: false; reason: string } {
    const validKeys = new Set(signals.map((s) => `[${s.key}]`));
    const referenced = new Set<string>();
    let cleaned = (text || "").trim().replace(SIGNAL_TOKEN_RE, (tok) => {
        if (validKeys.has(tok)) {
            referenced.add(tok);
            return tok;
        }
        return "";
    });

    cleaned = cleaned.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    if (!cleaned) {
        return { ok: false, reason: "Empty explanation after signal filter" };
    }
    if (referenced.size === 0) {
        return {
            ok: false,
            reason: "Explanation did not cite any computed signal",
        };
    }
    return { ok: true, text: cleaned };
}

/** Human-readable breakdown for the UI (deterministic, no LLM). */
export function signalRows(signals: LeadSignal[]): Array<{
    label: string;
    detail: string;
    positive: boolean;
    impact: number | null;
}> {
    return signals.map((s) => ({
        label: s.label,
        detail: s.detail,
        positive: s.positive,
        impact: s.score_impact ?? null,
    }));
}
