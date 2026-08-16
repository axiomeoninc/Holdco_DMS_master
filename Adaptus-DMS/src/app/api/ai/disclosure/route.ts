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
import { MVDA_DAMAGE_NOTES_REQUIRED } from "@/src/lib/mvda-damage";

/**
 * POST /api/ai/disclosure — Ontario MVDA disclosure draft.
 * Human must confirm before save. Does not auto-write to DB.
 */
export async function POST(req: NextRequest) {
    try {
        const gate = await requireAiCaller(req);
        if (!gate.ok) return gate.response;

        const body = await req.json().catch(() => ({}));
        const vehicleId = typeof body.vehicle_id === "string" ? body.vehicle_id : "";
        if (!vehicleId) {
            return NextResponse.json(
                { error: "vehicle_id is required" },
                { status: 400 }
            );
        }

        const { data: vehicle, error } = await supabaseAdmin
            .from("vehicles")
            .select(
                "id, year, make, model, vin, stock_number, condition, odometer, known_damage, disclosure, status, warranty, dealership_id"
            )
            .eq("id", vehicleId)
            .eq("dealership_id", gate.dealershipId)
            .maybeSingle();

        if (error) throw error;
        if (!vehicle) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const hints =
            typeof body.damage_notes === "string" ? body.damage_notes.trim() : "";

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        "\nDraft Ontario MVDA-style known-damage / condition disclosure notes for a used vehicle. " +
                        "Conservative language; do not invent accidents or repairs not provided. " +
                        "Return plain disclosure text only. Human must confirm before save. No think tags.",
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        year: vehicle.year,
                        make: vehicle.make,
                        model: vehicle.model,
                        vin: vehicle.vin,
                        condition: vehicle.condition,
                        odometer_km: vehicle.odometer,
                        known_damage: vehicle.known_damage,
                        existing_disclosure: vehicle.disclosure,
                        operator_hints: hints || null,
                        status: vehicle.status,
                        reminder: MVDA_DAMAGE_NOTES_REQUIRED,
                    }),
                },
            ],
            temperature: 0.3,
            max_completion_tokens: 600,
        });

        const content = stripThinkingArtifacts(result.content);
        if (!content) {
            return NextResponse.json(
                { error: "Empty disclosure from Flash AI — retry" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            data: {
                content,
                vehicle_id: vehicle.id,
                draft: true,
                requires_human_confirm: true,
                applied: false,
                note: "Draft only — confirm and Save disclosure on the VDP. Not auto-saved.",
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/disclosure]", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error ? err.message : "Disclosure helper failed",
            },
            { status: 500 }
        );
    }
}
