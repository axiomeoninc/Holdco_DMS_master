// AI correction log — record of human corrections/overrides of AI output.
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const VALID_KINDS = ["claims", "draft", "reply", "score", "other"];

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }
        const url = new URL(req.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50") || 50, 200);

        const { data, error } = await supabaseAdmin
            .from("ai_corrections")
            .select("*")
            .eq("dealership_id", dealershipId)
            .order("corrected_at", { ascending: false })
            .limit(limit);
        if (error) throw error;

        return NextResponse.json({ data: data ?? [] });
    } catch (error: unknown) {
        console.error("[ai/corrections] GET", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load corrections" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }

        const body = (await req.json()) as Record<string, unknown>;
        const kind =
            typeof body.kind === "string" && VALID_KINDS.includes(body.kind)
                ? body.kind
                : "other";
        const originalText =
            typeof body.original_text === "string" ? body.original_text.slice(0, 4000) : null;
        const correctedText =
            typeof body.corrected_text === "string" ? body.corrected_text.slice(0, 4000) : null;
        const leadId = typeof body.lead_id === "string" ? body.lead_id : null;
        const context =
            body.context && typeof body.context === "object"
                ? body.context
                : {};

        if (!correctedText) {
            return NextResponse.json(
                { error: "corrected_text is required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("ai_corrections")
            .insert({
                dealership_id: dealershipId,
                lead_id: leadId,
                kind,
                original_text: originalText,
                corrected_text: correctedText,
                context,
                corrected_by: auth.profile.id,
            })
            .select("*")
            .single();
        if (error) throw error;

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        console.error("[ai/corrections] POST", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to record correction" },
            { status: 500 }
        );
    }
}
