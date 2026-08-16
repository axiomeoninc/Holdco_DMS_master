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

function daysInStock(createdAt: string | null | undefined): number {
    if (!createdAt) return 0;
    return Math.max(
        0,
        Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
    );
}

/** POST /api/ai/price-narrative — price/aging narrative (no floor invention). */
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
                "id, year, make, model, trim, stock_number, status, retail_price, special_price, odometer, condition, created_at, dealership_id"
            )
            .eq("id", vehicleId)
            .eq("dealership_id", gate.dealershipId)
            .maybeSingle();

        if (error) throw error;
        if (!vehicle) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const aging = daysInStock(vehicle.created_at);

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        "\nWrite a short desk narrative on pricing posture vs aging. " +
                        "Use only provided retail/special prices. Never invent floors, cost, or market comps. " +
                        "Return plain text (2-4 short paragraphs). No think tags.",
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        year: vehicle.year,
                        make: vehicle.make,
                        model: vehicle.model,
                        trim: vehicle.trim,
                        stock_number: vehicle.stock_number,
                        status: vehicle.status,
                        retail_price_cad: vehicle.retail_price,
                        special_price_cad: vehicle.special_price,
                        odometer_km: vehicle.odometer,
                        condition: vehicle.condition,
                        days_in_stock: aging,
                        floor_price: null,
                        note: "Floors are operator-controlled and not available to AI.",
                    }),
                },
            ],
            temperature: 0.4,
            max_completion_tokens: 700,
        });

        const content = stripThinkingArtifacts(result.content);
        if (!content) {
            return NextResponse.json(
                { error: "Empty price narrative from Flash AI" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            data: {
                content,
                vehicle_id: vehicle.id,
                days_in_stock: aging,
                draft: true,
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/price-narrative]", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error ? err.message : "Price narrative failed",
            },
            { status: 500 }
        );
    }
}
