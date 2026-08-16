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

function errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string" && m.trim()) return m;
    }
    return "Desk brief failed";
}

/** GET /api/ai/desk-brief — daily desk brief widget (dealership-scoped). */
export async function GET(req: NextRequest) {
    try {
        const gate = await requireAiCaller(req);
        if (!gate.ok) return gate.response;

        const dealershipId = gate.dealershipId;

        let leads: Array<{
            status?: string | null;
            temperature?: string | null;
            source?: string | null;
        }> = [];
        let vehicles: Array<{
            year?: number | null;
            make?: string | null;
            model?: string | null;
            stock_number?: string | null;
            retail_price?: number | null;
            created_at?: string | null;
        }> = [];
        let deals: Array<{
            deal_status?: string | null;
            status?: string | null;
            sale_price?: number | null;
        }> = [];
        let followUps: Array<Record<string, unknown>> = [];

        try {
            const leadsRes = await supabaseAdmin
                .from("leads")
                .select("id, status, temperature, created_at, source")
                .eq("dealership_id", dealershipId)
                .order("created_at", { ascending: false })
                .limit(25);
            if (!leadsRes.error) leads = leadsRes.data ?? [];
        } catch {
            /* soft-fail */
        }

        try {
            const agingRes = await supabaseAdmin
                .from("vehicles")
                .select(
                    "id, year, make, model, stock_number, retail_price, status, created_at"
                )
                .eq("dealership_id", dealershipId)
                .ilike("status", "Active")
                .order("created_at", { ascending: true })
                .limit(40);
            if (!agingRes.error) vehicles = agingRes.data ?? [];
        } catch {
            /* soft-fail */
        }

        try {
            const dealsRes = await supabaseAdmin
                .from("sales_deals")
                .select("id, deal_status, status, sale_price, created_at")
                .eq("dealership_id", dealershipId)
                .order("created_at", { ascending: false })
                .limit(15);
            if (!dealsRes.error) deals = dealsRes.data ?? [];
        } catch {
            /* soft-fail */
        }

        try {
            const followUpsRes = await supabaseAdmin
                .from("follow_ups")
                .select("id, status, follow_up_date, notes, priority")
                .eq("dealership_id", dealershipId)
                .order("follow_up_date", { ascending: true })
                .limit(15);
            if (!followUpsRes.error) {
                followUps = (followUpsRes.data ?? []) as Array<
                    Record<string, unknown>
                >;
            }
        } catch {
            /* soft-fail */
        }

        const aging = vehicles
            .map((v) => ({
                year: v.year,
                make: v.make,
                model: v.model,
                stock_number: v.stock_number,
                retail_price: v.retail_price,
                days_in_stock: daysInStock(v.created_at),
            }))
            .filter((v) => v.days_in_stock >= 45)
            .slice(0, 10);

        const snapshot = {
            open_leads: leads.filter(
                (l) =>
                    String(l.status || "").toLowerCase() !== "closed" &&
                    String(l.status || "").toLowerCase() !== "converted"
            ).length,
            hot_leads: leads.filter(
                (l) => String(l.temperature || "").toLowerCase() === "hot"
            ).length,
            recent_leads: leads.slice(0, 8).map((l) => ({
                status: l.status,
                temperature: l.temperature,
                source: l.source,
            })),
            aging_units: aging,
            recent_deals: deals.slice(0, 8).map((d) => ({
                deal_status: d.deal_status || d.status,
                sale_price: d.sale_price,
            })),
            follow_ups_due: followUps.slice(0, 8),
        };

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        "\nWrite a crisp daily desk brief (bullet points) for the sales manager. " +
                        "Prioritize hot leads, aging inventory, and follow-ups. No invented numbers. No think tags.",
                },
                { role: "user", content: JSON.stringify(snapshot) },
            ],
            temperature: 0.35,
            max_completion_tokens: 900,
        });

        const content = stripThinkingArtifacts(result.content);
        if (!content) {
            return NextResponse.json(
                { error: "Empty desk brief from Flash AI" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            data: {
                content,
                snapshot: {
                    open_leads: snapshot.open_leads,
                    hot_leads: snapshot.hot_leads,
                    aging_count: aging.length,
                },
                generated_at: new Date().toISOString(),
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/desk-brief]", err);
        return NextResponse.json(
            { error: errMessage(err) },
            { status: 500 }
        );
    }
}
