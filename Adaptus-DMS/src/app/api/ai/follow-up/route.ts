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
} from "@/src/lib/ai/guard";
import { errMessage } from "@/src/lib/ai/errors";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

/**
 * POST /api/ai/follow-up — CASL-aware lead follow-up draft.
 * Never marks Sent. Human must copy/send.
 */
export async function POST(req: NextRequest) {
    try {
        const gate = await requireAiCaller(req);
        if (!gate.ok) return gate.response;

        const body = await req.json().catch(() => ({}));
        const leadId = typeof body.lead_id === "string" ? body.lead_id : "";
        const channel =
            body.channel === "sms" ? "sms" : ("email" as "email" | "sms");

        if (!leadId) {
            return NextResponse.json(
                { error: "lead_id is required" },
                { status: 400 }
            );
        }

        const { data: lead, error } = await supabaseAdmin
            .from("leads")
            .select(
                "id, status, source, notes, temperature, dealership_id, customer_id, interest_vehicle_id"
            )
            .eq("id", leadId)
            .eq("dealership_id", gate.dealershipId)
            .maybeSingle();

        if (error) throw error;
        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        let customer: {
            first_name?: string | null;
            name?: string | null;
            marketing_consent?: boolean | null;
            sms_consent?: boolean | null;
        } | null = null;
        if (lead.customer_id) {
            const { data: c } = await supabaseAdmin
                .from("customers")
                .select(
                    "id, name, first_name, last_name, email, phone, marketing_consent, sms_consent"
                )
                .eq("id", lead.customer_id)
                .eq("dealership_id", gate.dealershipId)
                .maybeSingle();
            customer = c;
        }

        let vehicle: {
            year?: number | null;
            make?: string | null;
            model?: string | null;
            stock_number?: string | null;
            retail_price?: number | null;
        } | null = null;
        if (lead.interest_vehicle_id) {
            const { data: v } = await supabaseAdmin
                .from("vehicles")
                .select("id, year, make, model, stock_number, retail_price")
                .eq("id", lead.interest_vehicle_id)
                .eq("dealership_id", gate.dealershipId)
                .maybeSingle();
            vehicle = v;
        }

        const consentOk =
            channel === "sms"
                ? Boolean(customer?.sms_consent)
                : Boolean(customer?.marketing_consent !== false);

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        `\nDraft a ${channel} follow-up for a lead. CASL-aware: include unsubscribe/opt-out language for email; keep SMS short. ` +
                        'Return JSON only: {"subject": string|null, "body": string, "casl_note": string}. ' +
                        "Do NOT claim the message was sent. Never include think tags or chain-of-thought.",
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        channel,
                        lead_status: lead.status,
                        source: lead.source,
                        notes: lead.notes,
                        temperature: lead.temperature,
                        customer_first_name:
                            customer?.first_name || customer?.name || "there",
                        vehicle,
                        consent_flag_present: consentOk,
                        intent: body.intent || "check_in",
                    }),
                },
            ],
            temperature: 0.5,
            max_completion_tokens: 700,
        });

        let parsed: {
            subject?: string | null;
            body?: string;
            casl_note?: string;
        } = {};
        try {
            const raw = extractJsonObject(result.content);
            if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                parsed = raw as typeof parsed;
            } else {
                throw new Error("Follow-up JSON was not an object");
            }
        } catch {
            const cleaned = stripThinkingArtifacts(result.content);
            parsed = {
                subject: channel === "email" ? "Following up" : null,
                body: cleaned,
                casl_note: "Review for CASL before send.",
            };
        }

        const draftBody = stripThinkingArtifacts(
            (parsed.body || "").trim() || stripThinkingArtifacts(result.content)
        );
        if (!draftBody) {
            return NextResponse.json(
                { error: "Flash AI returned an empty follow-up draft" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            data: {
                channel,
                subject: parsed.subject ?? null,
                body: draftBody,
                content: draftBody,
                casl_note:
                    typeof parsed.casl_note === "string" && parsed.casl_note.trim()
                        ? stripThinkingArtifacts(parsed.casl_note)
                        : "Draft only — human must review and send. Not marked Sent.",
                sent: false,
                draft: true,
                consent_warning: consentOk
                    ? null
                    : "Consent flag missing or false — confirm CASL before any commercial send.",
                lead_id: lead.id,
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/follow-up]", err);
        return NextResponse.json(
            { error: errMessage(err, "Follow-up draft failed") },
            { status: 500 }
        );
    }
}
