/**
 * After-hours 24/7 AI first response.
 *
 * Draft-first: the default behaviour is to produce a human-reviewable draft.
 * Auto-send only happens when ALL of the following are true:
 *   - outside business hours (quiet-hours window active)
 *   - dealership enabled `auto_send_enabled` in AI governance
 *   - the send channel is configured (Resend for email)
 *   - the customer has the relevant consent flag (CASL marketing consent)
 *   - the lead did not trigger escalation (pricing/finance/human requests)
 *
 * Every attempt — draft, send, block, escalate — is recorded in
 * `ai_desk_replies` with its bot-disclosure flag and consent state. No fake
 * sends: a row is only marked `sent` when the provider returned an id.
 *
 * Server-only module (uses supabaseAdmin + LLM + Resend).
 */

import {
    chatCompletion,
    extractJsonObject,
    FlashAiNotConfiguredError,
} from "@/src/lib/ai/llm";
import { DESK_SYSTEM, isQuietHour, type QuietHoursConfig } from "@/src/lib/ai/guard";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { crmEmail } from "@/src/lib/email";
import { isResendConfigured, sendEmail } from "@/src/lib/resend";
import { resolveEmailFrom } from "@/src/lib/email/from";
import { buildUnsubscribeUrl } from "@/src/lib/casl-unsubscribe";

// ---------------------------------------------------------------------------
// Escalation triggers
// ---------------------------------------------------------------------------

const ESCALATION_PATTERNS: Array<{ re: RegExp; reason: string }> = [
    { re: /\bpric(e|ing|es)\b/i, reason: "lead asked about pricing" },
    { re: /\bfinanc(e|ing|ial|er)\b/i, reason: "lead asked about financing" },
    {
        re: /\b(loan|lease|oac|approval|credit|buy here pay here|bhp)\b/i,
        reason: "lead asked about finance/approval",
    },
    {
        re: /\b(human|salesperson|manager|representative|representative|agent|talk to someone)\b/i,
        reason: "lead asked for a human",
    },
    { re: /\b(trade[-\s]?in|payoff)\b/i, reason: "lead asked about trade-in/equity" },
];

/** Returns escalation reasons found in free text (lead notes / message). */
export function findEscalationTriggers(text: string | null | undefined): string[] {
    if (!text?.trim()) return [];
    return ESCALATION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.reason);
}

/** Standard bot-disclosure line required on every AI-sent message. */
export function botDisclosure(dealershipName: string | null): string {
    const dealer = dealershipName?.trim() || "this dealership";
    return `This message was drafted by Flash AI on behalf of ${dealer} and is being sent to help you. A team member can always step in — just reply and ask.`;
}

export const DEFAULT_AFTER_HOURS_SYSTEM =
    DESK_SYSTEM +
    `\nDraft the first response to a NEW lead arriving outside business hours.
Rules:
- Warm, helpful, short. Identify the vehicle the lead asked about.
- Do NOT invent prices, fees, availability, or promises.
- Reference only facts provided in the context block.
- Return JSON only: {"subject": string|null, "body": string}.
- The final message must be ready for a human to send; never claim it was sent.`;

// ---------------------------------------------------------------------------
// Context + draft + send
// ---------------------------------------------------------------------------

export interface AfterHoursLeadContext {
    lead: {
        id: string;
        notes: string | null;
        source: string | null;
        status: string | null;
        customer_id: string | null;
        interest_vehicle_id: string | null;
    } | null;
    customer: {
        id: string;
        name: string | null;
        email: string | null;
        phone: string | null;
        marketing_consent: boolean | null;
        sms_consent: boolean | null;
    } | null;
    vehicle: {
        year: number | null;
        make: string | null;
        model: string | null;
        stock_number: string | null;
        retail_price: number | null;
    } | null;
    dealershipName: string | null;
    /** Resolved sender for this dealership (settings.email_from → EMAIL_FROM). */
    emailFrom: string | null;
    /** Raw dealership settings used for config gating (email_from/display_name). */
    settings: Record<string, unknown> | null;
    config: QuietHoursConfig & { auto_send_enabled: boolean };
}

export async function loadAfterHoursContext(
    dealershipId: string,
    leadId: string
): Promise<AfterHoursLeadContext | { error: string }> {
    const { data: lead, error } = await supabaseAdmin
        .from("leads")
        .select(
            "id, notes, source, status, customer_id, interest_vehicle_id, dealership_id"
        )
        .eq("id", leadId)
        .eq("dealership_id", dealershipId)
        .maybeSingle();
    if (error) throw error;
    if (!lead) return { error: "Lead not found" };

    const { data: dealership } = await supabaseAdmin
        .from("dealerships")
        .select("name, settings")
        .eq("id", dealershipId)
        .maybeSingle();

    let customer: AfterHoursLeadContext["customer"] = null;
    if (lead.customer_id) {
        const { data: c } = await supabaseAdmin
            .from("customers")
            .select(
                "id, name, email, phone, marketing_consent, sms_consent"
            )
            .eq("id", lead.customer_id)
            .maybeSingle();
        customer = c ?? null;
    }

    let vehicle: AfterHoursLeadContext["vehicle"] = null;
    if (lead.interest_vehicle_id) {
        const { data: v } = await supabaseAdmin
            .from("vehicles")
            .select("year, make, model, stock_number, retail_price")
            .eq("id", lead.interest_vehicle_id)
            .maybeSingle();
        vehicle = v ?? null;
    }

    let config: AfterHoursLeadContext["config"] = {
        quiet_hours_enabled: true,
        quiet_hours_start: "20:00",
        quiet_hours_end: "09:00",
        quiet_hours_timezone: "America/Toronto",
        auto_send_enabled: false,
    };
    const { data: gov } = await supabaseAdmin
        .from("ai_governance_config")
        .select(
            "quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, auto_send_enabled"
        )
        .eq("dealership_id", dealershipId)
        .maybeSingle();
    if (gov) {
        config = {
            quiet_hours_enabled: gov.quiet_hours_enabled !== false,
            quiet_hours_start:
                typeof gov.quiet_hours_start === "string" && gov.quiet_hours_start
                    ? gov.quiet_hours_start
                    : "20:00",
            quiet_hours_end:
                typeof gov.quiet_hours_end === "string" && gov.quiet_hours_end
                    ? gov.quiet_hours_end
                    : "09:00",
            quiet_hours_timezone: gov.quiet_hours_timezone ?? null,
            auto_send_enabled: Boolean(gov.auto_send_enabled),
        };
    }

    return {
        lead: lead as AfterHoursLeadContext["lead"],
        customer,
        vehicle,
        dealershipName: dealership?.name ?? null,
        emailFrom: dealership?.settings
            ? resolveEmailFrom(
                  (dealership.settings as Record<string, unknown>) || null
              ).from
            : null,
        settings: dealership?.settings
            ? (dealership.settings as Record<string, unknown>)
            : null,
        config,
    };
}

export function vehicleLabel(v: AfterHoursLeadContext["vehicle"]): string | null {
    if (!v) return null;
    return [v.year, v.make, v.model].filter(Boolean).join(" ");
}

export type DraftResult = {
    subject: string | null;
    body: string;
};

/** Generate a first-response draft. */
export async function draftFirstResponse(
    ctx: AfterHoursLeadContext
): Promise<DraftResult> {
    const firstName = (ctx.customer?.name || "").trim().split(/\s+/)[0];
    const result = await chatCompletion({
        messages: [
            { role: "system", content: DEFAULT_AFTER_HOURS_SYSTEM },
            {
                role: "user",
                content: JSON.stringify({
                    customer_first_name: firstName || "there",
                    dealership_name: ctx.dealershipName,
                    vehicle: ctx.vehicle
                        ? {
                              ...ctx.vehicle,
                              retail_price: ctx.vehicle.retail_price,
                          }
                        : null,
                    lead_notes: ctx.lead?.notes,
                    lead_source: ctx.lead?.source,
                    channel: "email",
                    escalation_hint:
                        "If the lead asks for pricing/finance/human, say a team member will follow up — do not quote pricing.",
                }),
            },
        ],
        temperature: 0.4,
        max_completion_tokens: 600,
    });

    let parsed: { subject?: string | null; body?: string } = {};
    try {
        const raw = extractJsonObject(result.content);
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            parsed = raw as typeof parsed;
        } else {
            parsed = { subject: null, body: result.content };
        }
    } catch {
        parsed = { subject: null, body: result.content };
    }

    const body = (parsed.body || result.content || "").trim();
    if (!body) {
        throw new Error("Flash AI returned an empty after-hours draft");
    }
    return { subject: parsed.subject ?? null, body };
}

export type FirstResponseResult =
    | { decision: "draft"; replyId: string; subject: string | null; body: string }
    | { decision: "sent"; replyId: string; sendProviderId: string; subject: string | null; body: string }
    | { decision: "escalate"; reason: string; body?: never }
    | {
          decision: "blocked";
          reason: "not_quiet_hours" | "auto_send_disabled" | "not_configured" | "no_consent" | "no_email";
          detail: string;
          replyId?: string;
      };

/**
 * Run the after-hours first response.
 * `action: "draft"` → draft only (recorded). `"draft_and_send"` → full gate.
 */
export async function runAfterHoursFirstResponse(opts: {
    dealershipId: string;
    leadId: string;
    userId: string;
    action: "draft" | "draft_and_send";
}): Promise<FirstResponseResult> {
    const ctx = await loadAfterHoursContext(opts.dealershipId, opts.leadId);
    if ("error" in ctx) {
        throw new Error(ctx.error);
    }

    const escalationReasons = findEscalationTriggers(ctx.lead?.notes);
    const consentOk = Boolean(ctx.customer?.marketing_consent);
    const now = new Date();
    const inQuietHours = isQuietHour(now, ctx.config);
    const disclosure = botDisclosure(ctx.dealershipName);

    // Escalation always wins — never auto-send when a human is requested.
    if (escalationReasons.length > 0) {
        const { error: escErr } = await supabaseAdmin.from("ai_desk_replies").insert({
            dealership_id: opts.dealershipId,
            lead_id: opts.leadId,
            customer_id: ctx.customer?.id ?? null,
            channel: "email",
            status: "escalated",
            subject: null,
            body: `Escalated to human: ${escalationReasons.join("; ")}`,
            bot_disclosure: false,
            consent_ok: consentOk,
            escalated_to_human: true,
            escalate_reason: escalationReasons.join("; "),
            created_by: opts.userId,
        });
        if (escErr) console.warn("[after-hours] escalate insert", escErr.message);
        return { decision: "escalate", reason: escalationReasons.join("; ") };
    }

    const draft = await draftFirstResponse(ctx);
    const bodyWithDisclosure = `${draft.body}\n\n${disclosure}`;

    // Draft-only path (default and safe).
    if (opts.action !== "draft_and_send") {
        const { data: row, error: insErr } = await supabaseAdmin
            .from("ai_desk_replies")
            .insert({
                dealership_id: opts.dealershipId,
                lead_id: opts.leadId,
                customer_id: ctx.customer?.id ?? null,
                channel: "email",
                status: "draft",
                subject: draft.subject,
                body: bodyWithDisclosure,
                bot_disclosure: true,
                consent_ok: consentOk,
                escalated_to_human: false,
                created_by: opts.userId,
            })
            .select("id")
            .single();
        if (insErr) throw insErr;
        return {
            decision: "draft",
            replyId: row.id,
            subject: draft.subject,
            body: bodyWithDisclosure,
        };
    }

    // Auto-send gate.
    if (!inQuietHours) {
        return { decision: "blocked", reason: "not_quiet_hours", detail: "Business hours — desk handles replies." };
    }
    if (!ctx.config.auto_send_enabled) {
        return {
            decision: "blocked",
            reason: "auto_send_disabled",
            detail: "Auto-send is disabled in AI Governance — draft saved for review.",
        };
    }
    if (!isResendConfigured(ctx.settings)) {
        return {
            decision: "blocked",
            reason: "not_configured",
            detail:
                "Email sending is not configured (RESEND_API_KEY / EMAIL_FROM or dealership email_from).",
        };
    }
    if (!consentOk) {
        return {
            decision: "blocked",
            reason: "no_consent",
            detail: "Customer has not consented to marketing email (CASL).",
        };
    }
    if (!ctx.customer?.email?.trim()) {
        return {
            decision: "blocked",
            reason: "no_email",
            detail: "Customer has no email address on file.",
        };
    }

    let unsubscribeUrl: string | undefined;
    try {
        unsubscribeUrl = await buildUnsubscribeUrl(ctx.customer.email);
    } catch {
        /* footer best-effort */
    }

    const mail = crmEmail({
        subject: draft.subject || `Re: your inquiry — ${ctx.dealershipName || ""}`.trim(),
        bodyHtml: bodyWithDisclosure
            .split("\n")
            .map((line) => `<p>${line.replace(/</g, "&lt;")}</p>`)
            .join(""),
        bodyText: bodyWithDisclosure,
        dealershipName: ctx.dealershipName,
        unsubscribeUrl,
    });

    const sent = await sendEmail({
        to: ctx.customer.email,
        from: ctx.emailFrom ?? undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        listUnsubscribeUrl: unsubscribeUrl,
    });

    if (!sent.ok) {
        const { data: row } = await supabaseAdmin
            .from("ai_desk_replies")
            .insert({
                dealership_id: opts.dealershipId,
                lead_id: opts.leadId,
                customer_id: ctx.customer.id,
                channel: "email",
                status: "failed",
                subject: draft.subject,
                body: bodyWithDisclosure,
                bot_disclosure: true,
                consent_ok: consentOk,
                escalated_to_human: false,
                error: sent.error,
                created_by: opts.userId,
            })
            .select("id")
            .single();
        return {
            decision: "blocked",
            reason: "not_configured",
            detail: sent.error,
            replyId: row?.id,
        };
    }

    const { data: row } = await supabaseAdmin
        .from("ai_desk_replies")
        .insert({
            dealership_id: opts.dealershipId,
            lead_id: opts.leadId,
            customer_id: ctx.customer.id,
            channel: "email",
            status: "sent",
            subject: draft.subject,
            body: bodyWithDisclosure,
            bot_disclosure: true,
            consent_ok: consentOk,
            escalated_to_human: false,
            send_provider_id: sent.id,
            sent_at: new Date().toISOString(),
            created_by: opts.userId,
        })
        .select("id")
        .single();

    return {
        decision: "sent",
        replyId: row?.id ?? "",
        sendProviderId: sent.id,
        subject: draft.subject,
        body: bodyWithDisclosure,
    };
}

export { FlashAiNotConfiguredError };
