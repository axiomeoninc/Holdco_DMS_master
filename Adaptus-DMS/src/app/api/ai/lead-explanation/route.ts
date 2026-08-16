import { NextRequest, NextResponse } from "next/server";
import {
    chatCompletion,
    extractJsonObject,
    FlashAiNotConfiguredError,
    stripThinkingArtifacts,
} from "@/src/lib/ai/llm";
import {
    DESK_SYSTEM,
    requireAiCaller,
    aiNotConfiguredResponse,
    validateClaimsGuardrail,
} from "@/src/lib/ai/guard";
import { errMessage } from "@/src/lib/ai/errors";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { resolveLeadScore } from "@/src/lib/business/lead-score";
import {
    extractLeadSignals,
    signalFactsText,
    sanitizeExplanation,
    type LeadSignal,
} from "@/src/lib/business/lead-explainer";

const EXPLAIN_SYSTEM =
    DESK_SYSTEM +
    `\nYou are explaining why a lead was scored Hot/Warm/Cold.
Rules:
- Use ONLY the "[S#]" facts provided. Never invent visits, emails, calls, prices, or dates.
- Each paragraph must cite at least one "[S#]" token.
- Suggest ONE next action tied to a cited signal (e.g. quote, call, hold).
- Return JSON only: {"explanation": string, "action": string}.
- Never include think tags or chain-of-thought.`;

/**
 * POST /api/ai/lead-explanation
 * Body: { lead_id: string }
 * Deterministic signals are recomputed server-side; the LLM only paraphrases them.
 */
export async function POST(req: NextRequest) {
    try {
        const gate = await requireAiCaller(req);
        if (!gate.ok) return gate.response;

        const body = await req.json().catch(() => ({}));
        const leadId = typeof body.lead_id === "string" ? body.lead_id : "";
        if (!leadId) {
            return NextResponse.json(
                { error: "lead_id is required" },
                { status: 400 }
            );
        }

        const { data: lead, error } = await supabaseAdmin
            .from("leads")
            .select(
                "id, status, source, notes, last_engagement, lead_creation_date, created_at, interest_vehicle_id, temperature, score, dealership_id, customer_id"
            )
            .eq("id", leadId)
            .eq("dealership_id", gate.dealershipId)
            .maybeSingle();

        if (error) throw error;
        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        let customerName: string | null = null;
        if (lead.customer_id) {
            const { data: c } = await supabaseAdmin
                .from("customers")
                .select("name")
                .eq("id", lead.customer_id)
                .eq("dealership_id", gate.dealershipId)
                .maybeSingle();
            customerName = c?.name ?? null;
        }

        const signals: LeadSignal[] = extractLeadSignals(lead);
        const facts = signalFactsText(signals);
        const scored = resolveLeadScore(lead);

        // Governance: load blocked claims for this dealership (amber default).
        const { data: gov } = await supabaseAdmin
            .from("ai_governance_config")
            .select("blocked_claims, claims_guardrail_enabled")
            .eq("dealership_id", gate.dealershipId)
            .maybeSingle();
        const blockedClaims: string[] =
            gov?.claims_guardrail_enabled === false
                ? []
                : Array.isArray(gov?.blocked_claims) && gov.blocked_claims.length
                  ? gov.blocked_claims
                  : [];

        const result = await chatCompletion({
            messages: [
                { role: "system", content: EXPLAIN_SYSTEM },
                {
                    role: "user",
                    content: JSON.stringify({
                        customer_name: customerName,
                        temperature: scored.temperature,
                        score: scored.score,
                        facts,
                    }),
                },
            ],
            temperature: 0.4,
            max_completion_tokens: 500,
        });

        let parsed: { explanation?: string; action?: string } = {};
        try {
            const raw = extractJsonObject(result.content);
            if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                parsed = raw as typeof parsed;
            }
        } catch {
            parsed = {};
        }

        const prose = stripThinkingArtifacts(result.content).trim();
        let rawExplanation =
            typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
        if (!rawExplanation && prose) {
            rawExplanation = prose;
        }
        if (!rawExplanation) {
            return NextResponse.json(
                { error: "Flash AI returned an empty explanation" },
                { status: 502 }
            );
        }

        const cleaned = sanitizeExplanation(rawExplanation, signals);
        if (!cleaned.ok) {
            return NextResponse.json(
                { error: `Explanation rejected: ${cleaned.reason}` },
                { status: 502 }
            );
        }

        // Claims guardrail on the customer-facing explanation.
        const guard = validateClaimsGuardrail(cleaned.text, blockedClaims);
        if (!guard.ok) {
            return NextResponse.json(
                { error: `Explanation blocked: ${guard.message}` },
                { status: 422 }
            );
        }

        const action =
            (typeof parsed.action === "string" ? parsed.action : "")
                .trim()
                .slice(0, 200) || "Review the lead and follow up.";
        const now = new Date().toISOString();

        // Persist on the lead + append to the audit history.
        await supabaseAdmin
            .from("leads")
            .update({ ai_why: cleaned.text, ai_why_at: now })
            .eq("id", lead.id)
            .eq("dealership_id", gate.dealershipId);

        const { error: histErr } = await supabaseAdmin
            .from("lead_score_explanations")
            .insert({
                lead_id: lead.id,
                dealership_id: gate.dealershipId,
                signals: signals as unknown as object[],
                explanation: cleaned.text,
                model: "flash-ai",
                generated_by: gate.profile.id,
            });
        if (histErr) {
            console.warn("[ai/lead-explanation] history insert skipped", histErr.message);
        }

        return NextResponse.json({
            data: {
                explanation: cleaned.text,
                action,
                temperature: scored.temperature,
                score: scored.score,
                signals: signals.map((s) => ({
                    key: s.key,
                    label: s.label,
                    detail: s.detail,
                    positive: s.positive,
                    score_impact: s.score_impact ?? null,
                })),
                sent: false,
                draft: true,
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/lead-explanation]", err);
        return NextResponse.json(
            { error: errMessage(err, "Explanation failed") },
            { status: 500 }
        );
    }
}
