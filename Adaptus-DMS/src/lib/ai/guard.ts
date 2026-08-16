/**
 * Shared auth / honesty helpers for /api/ai/* routes.
 */

import { NextRequest, NextResponse } from "next/server";
import {
    jsonAuthError,
    requireDealershipAccess,
    type UserProfile,
} from "@/src/lib/auth-helpers";
import { isFlashAiConfigured } from "@/src/lib/ai/llm";
import { parseClock } from "@/src/lib/ai/clock";
export { formatClock } from "@/src/lib/ai/clock";

export const AI_NOT_CONFIGURED_MESSAGE =
    "Flash AI not configured — add via wrangler when ready.";

export function aiNotConfiguredResponse(): NextResponse {
    return NextResponse.json(
        {
            error: AI_NOT_CONFIGURED_MESSAGE,
            code: "flash_ai_not_configured",
            configured: false,
        },
        { status: 503 }
    );
}

export async function requireAiCaller(
    req: NextRequest
): Promise<
    | { ok: true; profile: UserProfile; dealershipId: string }
    | { ok: false; response: NextResponse }
> {
    const auth = await requireDealershipAccess(req);
    if (auth.error || !auth.profile) {
        return { ok: false, response: jsonAuthError(auth) };
    }

    const dealershipId = auth.dealership_id;
    if (!dealershipId && !auth.profile.is_platform_admin) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "No dealership context" },
                { status: 403 }
            ),
        };
    }

    if (!dealershipId) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error:
                        "Platform admin must operate within a dealership context for AI tools",
                },
                { status: 400 }
            ),
        };
    }

    if (!isFlashAiConfigured()) {
        return { ok: false, response: aiNotConfiguredResponse() };
    }

    return { ok: true, profile: auth.profile, dealershipId };
}

export const DESK_SYSTEM = `You are Flash AI, a desk copilot for a Canadian (Ontario) used-car dealership using FlashFender DMS.
Rules:
- Be concise, practical, and honest. Never invent inventory, prices, floors, customers, or "Sent" status.
- Only use tool data for facts. If tools return nothing, say so.
- Do not expose purchase_price, floors, or cost basis. Retail/special asking price only.
- CASL: draft emails/SMS are drafts only — human must review and send. Never claim a message was sent.
- Ontario MVDA: disclosure helpers are drafts requiring human confirm before save.
- Currency: CAD. Tone: professional dealership desk.
- Never include chain-of-thought, reasoning tags, or <think> blocks in user-visible output. Reply as Flash AI only.`;

// ---------------------------------------------------------------------------
// Claims guardrails (FTC: "AI claims are dealer claims")
// ---------------------------------------------------------------------------

export const DEFAULT_BLOCKED_CLAIMS: string[] = [
    "best price guarantee",
    "lowest price",
    "guaranteed approval",
    "no credit check",
    "0 down guaranteed",
    "anyone can get financed",
    "certified by manufacturer",
    "warranty covers everything",
    "this will not affect your credit",
    "price locked forever",
];

export interface ClaimsGuardrailResult {
    ok: boolean;
    blocked: string[];
    message: string;
}

/**
 * Check free text against a blocked-claims list. Case-insensitive substring
 * match. Honesty gate for any AI output shown to a customer.
 */
export function validateClaimsGuardrail(
    text: string,
    blockedClaims: string[]
): ClaimsGuardrailResult {
    const needle = (text || "").toLowerCase();
    const blocked = (blockedClaims || [])
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
        .filter((c) => needle.includes(c));
    if (blocked.length > 0) {
        return {
            ok: false,
            blocked,
            message: `Output contains blocked claims: ${blocked.join(", ")}`,
        };
    }
    return { ok: true, blocked: [], message: "" };
}

// ---------------------------------------------------------------------------
// Quiet-hours helpers (used by after-hours AI first response + governance)
// ---------------------------------------------------------------------------

export interface QuietHoursConfig {
    quiet_hours_enabled: boolean;
    /** "HH:MM" 24h start of quiet window. */
    quiet_hours_start: string;
    /** "HH:MM" 24h end of quiet window (may wrap past midnight). */
    quiet_hours_end: string;
    /** IANA tz for interpreting the window (best-effort in Edge runtime). */
    quiet_hours_timezone?: string | null;
}

function isOvernightWindow(startMin: number, endMin: number): boolean {
    return endMin <= startMin;
}

function minuteOfDay(now: Date): number {
    return now.getHours() * 60 + now.getMinutes();
}

/**
 * True when `now` falls inside the configured quiet window.
 * No timezone math is attempted at runtime — the config records a tz so the
 * console can display it; enforcement uses server-local time.
 */
export function isQuietHour(now: Date, config: QuietHoursConfig): boolean {
    if (!config?.quiet_hours_enabled) return false;
    const start = parseClock(config.quiet_hours_start);
    const end = parseClock(config.quiet_hours_end);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    const minute = minuteOfDay(now);
    if (isOvernightWindow(start, end)) {
        return minute >= start || minute < end;
    }
    return minute >= start && minute < end;
}

