import { NextRequest, NextResponse } from "next/server";
import {
    chatCompletion,
    FlashAiNotConfiguredError,
    stripThinkingArtifacts,
} from "@/src/lib/ai/llm";
import {
    DESK_SYSTEM,
    requireAiCaller,
    aiNotConfiguredResponse,
} from "@/src/lib/ai/guard";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

/** POST /api/ai/quote-coach — objection / close coaching for a quotation. */
export async function POST(req: NextRequest) {
    try {
        const gate = await requireAiCaller(req);
        if (!gate.ok) return gate.response;

        const body = await req.json().catch(() => ({}));
        const quotationId =
            typeof body.quotation_id === "string" ? body.quotation_id : "";
        const objection =
            typeof body.objection === "string" ? body.objection.trim() : "";

        if (!quotationId && !objection) {
            return NextResponse.json(
                { error: "quotation_id or objection is required" },
                { status: 400 }
            );
        }

        let quoteContext: Record<string, unknown> | null = null;
        if (quotationId) {
            const { data, error } = await supabaseAdmin
                .from("quotations")
                .select(
                    "id, quote_number, status, sale_price, down_payment, notes, vehicle_id, customer_id, dealership_id, created_at"
                )
                .eq("id", quotationId)
                .eq("dealership_id", gate.dealershipId)
                .maybeSingle();
            if (error) throw error;
            if (!data) {
                return NextResponse.json(
                    { error: "Quotation not found" },
                    { status: 404 }
                );
            }
            quoteContext = data;
        }

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        "\nYou are a quote desk coach. Suggest 2-4 talking points to handle objections honestly. " +
                        "No pressure tactics, no false urgency, no invented discounts or lender approvals. Plain text. No think tags.",
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        quotation: quoteContext,
                        objection: objection || "price too high",
                        extra: body.context || null,
                    }),
                },
            ],
            temperature: 0.45,
            max_completion_tokens: 700,
        });

        const content = stripThinkingArtifacts(result.content);
        if (!content) {
            return NextResponse.json(
                { error: "Empty quote coach from Flash AI" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            data: {
                content,
                quotation_id: quotationId || null,
                draft: true,
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/quote-coach]", err);
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Quote coach failed",
            },
            { status: 500 }
        );
    }
}
