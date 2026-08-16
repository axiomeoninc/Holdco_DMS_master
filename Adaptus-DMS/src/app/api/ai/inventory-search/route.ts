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

export type InventorySearchFilters = {
    q?: string;
    make?: string;
    model?: string;
    status?: string;
    min_price?: number;
    max_price?: number;
    min_year?: number;
    max_year?: number;
    max_odometer?: number;
    aging_only?: boolean;
    min_days_in_stock?: number;
};

/** POST /api/ai/inventory-search — NL → structured filter params (no DB mutate). */
export async function POST(req: NextRequest) {
    try {
        const gate = await requireAiCaller(req);
        if (!gate.ok) return gate.response;

        const body = await req.json().catch(() => ({}));
        const query = typeof body.query === "string" ? body.query.trim() : "";
        if (!query) {
            return NextResponse.json(
                { error: "query is required" },
                { status: 400 }
            );
        }

        const result = await chatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        DESK_SYSTEM +
                        "\nConvert a natural-language inventory search into JSON filters only. " +
                        'Schema: {"q","make","model","status","min_price","max_price","min_year","max_year","max_odometer","aging_only","min_days_in_stock","explanation"}. ' +
                        "Omit unknown fields. status usually Active/Pending/Sold/Coming Soon. Prices CAD numbers. Return JSON only. Never include think tags.",
                },
                { role: "user", content: query.slice(0, 500) },
            ],
            temperature: 0.1,
            max_completion_tokens: 400,
        });

        let filters: InventorySearchFilters & { explanation?: string } = {};
        try {
            const raw = extractJsonObject(result.content);
            if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                filters = raw as typeof filters;
            } else {
                filters = {
                    q: query,
                    explanation: "Search applied as keywords",
                };
            }
        } catch {
            filters = {
                q: query,
                explanation: "Search applied as keywords",
            };
        }

        const clean: InventorySearchFilters = {};
        if (typeof filters.q === "string") clean.q = filters.q;
        if (typeof filters.make === "string") clean.make = filters.make;
        if (typeof filters.model === "string") clean.model = filters.model;
        if (typeof filters.status === "string") clean.status = filters.status;
        for (const key of [
            "min_price",
            "max_price",
            "min_year",
            "max_year",
            "max_odometer",
            "min_days_in_stock",
        ] as const) {
            const v = filters[key];
            if (typeof v === "number" && Number.isFinite(v)) clean[key] = v;
        }
        if (typeof filters.aging_only === "boolean") {
            clean.aging_only = filters.aging_only;
        }

        return NextResponse.json({
            data: {
                filters: clean,
                explanation:
                    typeof filters.explanation === "string"
                        ? stripThinkingArtifacts(filters.explanation)
                        : null,
                query,
            },
        });
    } catch (err) {
        if (err instanceof FlashAiNotConfiguredError) {
            return aiNotConfiguredResponse();
        }
        console.error("[ai/inventory-search]", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error ? err.message : "Inventory search failed",
            },
            { status: 500 }
        );
    }
}
