import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { buildAiCaption, buildTemplateCaption, isOpenAiConfigured } from "@/src/lib/social/captions";

/**
 * Generate a caption for a vehicle — OpenAI when OPENAI_API_KEY set, else YMM/price template.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const vehicleId = body.vehicle_id as string | undefined;
        const preferAi = body.ai !== false;

        if (!vehicleId) {
            return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
        }

        let query = supabaseAdmin
            .from("vehicles")
            .select("id, year, make, model, vin, retail_price, stock_number, dealership_id")
            .eq("id", vehicleId);

        if (dealershipId && !auth.profile.is_platform_admin) {
            query = query.eq("dealership_id", dealershipId);
        }

        const { data: vehicle, error } = await query.maybeSingle();
        if (error) throw error;
        if (!vehicle) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        if (
            dealershipId &&
            vehicle.dealership_id &&
            vehicle.dealership_id !== dealershipId &&
            !auth.profile.is_platform_admin
        ) {
            return NextResponse.json({ error: "Vehicle not in your dealership" }, { status: 403 });
        }

        const input = {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            vin: vehicle.vin,
            retail_price: vehicle.retail_price,
            stock_number: vehicle.stock_number,
        };

        if (preferAi && isOpenAiConfigured()) {
            const result = await buildAiCaption(input);
            return NextResponse.json({
                data: {
                    content: result.content,
                    source: result.source,
                    ai_available: true,
                },
            });
        }

        return NextResponse.json({
            data: {
                content: buildTemplateCaption(input),
                source: "template",
                ai_available: isOpenAiConfigured(),
            },
        });
    } catch (error: unknown) {
        console.error("Error generating social caption:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
