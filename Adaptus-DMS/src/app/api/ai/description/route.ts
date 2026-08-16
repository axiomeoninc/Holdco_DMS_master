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

/** POST /api/ai/description — auto listing description (draft only). */
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
                "id, year, make, model, trim, vin, stock_number, odometer, condition, exterior_color, interior_color, fuel_type, transmission, drivetrain, body_style, retail_price, special_price, features, description, warranty, known_damage, dealership_id"
            )
            .eq("id", vehicleId)
            .eq("dealership_id", gate.dealershipId)
            .maybeSingle();

        if (error) throw error;
        if (!vehicle) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        "\nWrite a merchandising vehicle description for the lot/VDP. Honest, no emoji spam, CAD price only if provided. Return description text only — no markdown fences, no think tags.",
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        year: vehicle.year,
                        make: vehicle.make,
                        model: vehicle.model,
                        trim: vehicle.trim,
                        odometer_km: vehicle.odometer,
                        condition: vehicle.condition,
                        exterior_color: vehicle.exterior_color,
                        interior_color: vehicle.interior_color,
                        fuel_type: vehicle.fuel_type,
                        transmission: vehicle.transmission,
                        drivetrain: vehicle.drivetrain,
                        body_style: vehicle.body_style,
                        retail_price_cad: vehicle.retail_price,
                        special_price_cad: vehicle.special_price,
                        features: vehicle.features,
                        warranty: vehicle.warranty,
                        known_damage: vehicle.known_damage,
                        existing_description: vehicle.description,
                        tone: body.tone || "professional",
                    }),
                },
            ],
            temperature: 0.55,
            max_completion_tokens: 900,
        });

        const content = stripThinkingArtifacts(result.content);
        if (!content) {
            return NextResponse.json(
                { error: "Empty description from Flash AI" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            data: {
                content,
                vehicle_id: vehicle.id,
                draft: true,
                applied: false,
                note: "Draft only — review before saving to the vehicle.",
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/description]", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error ? err.message : "Description generation failed",
            },
            { status: 500 }
        );
    }
}
