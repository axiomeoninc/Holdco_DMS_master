/**
 * Social caption helpers — YMM/price template + optional OpenAI rewrite.
 */

export type CaptionVehicle = {
    year: number;
    make: string;
    model: string;
    vin: string;
    retail_price?: number | null;
    stock_number?: string | null;
};

export function buildTemplateCaption(v: CaptionVehicle): string {
    const price =
        v.retail_price != null
            ? new Intl.NumberFormat("en-CA", {
                  style: "currency",
                  currency: "CAD",
                  maximumFractionDigits: 0,
              }).format(Number(v.retail_price))
            : null;
    const stock = v.stock_number || v.vin;
    const lines = [
        `${v.year} ${v.make} ${v.model}`,
        price ? `Asking ${price} + taxes` : null,
        `Stock / VIN: ${stock}`,
        "",
        "Message us for a test drive or more details.",
    ];
    return lines.filter((l) => l !== null).join("\n");
}

export function isOpenAiConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Optional AI caption. Falls back to template on any failure.
 */
export async function buildAiCaption(v: CaptionVehicle): Promise<{
    content: string;
    source: "openai" | "template";
}> {
    const template = buildTemplateCaption(v);
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
        return { content: template, source: "template" };
    }

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: process.env.OPENAI_SOCIAL_MODEL?.trim() || "gpt-4o-mini",
                temperature: 0.7,
                max_tokens: 280,
                messages: [
                    {
                        role: "system",
                        content:
                            "You write short Facebook Page captions for a Canadian auto dealership. " +
                            "Honest, no emojis overload, no false claims, include year/make/model and asking price when given. " +
                            "Invite a test drive. Return caption text only.",
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            year: v.year,
                            make: v.make,
                            model: v.model,
                            vin: v.vin,
                            stock_number: v.stock_number,
                            retail_price_cad: v.retail_price,
                            seed: template,
                        }),
                    },
                ],
            }),
        });
        if (!res.ok) {
            console.warn("[social] OpenAI caption failed:", res.status);
            return { content: template, source: "template" };
        }
        const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (!text) return { content: template, source: "template" };
        return { content: text, source: "openai" };
    } catch (err) {
        console.warn("[social] OpenAI caption error:", err);
        return { content: template, source: "template" };
    }
}
