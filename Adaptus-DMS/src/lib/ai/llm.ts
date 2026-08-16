/**
 * Flash AI LLM client (server-only).
 * OpenAI-compatible chat API. Env secret name stays server-only — never show in UI.
 */

import {
    extractJsonObject,
    resolveAssistantText,
    stripThinkingArtifacts,
    ThinkingStreamSanitizer,
} from "@/src/lib/ai/sanitize";

/** Upstream API base (server-only). */
const LLM_BASE_URL = "https://api.minimax.io/v1";
/** Upstream model id for request body (server-only; never return to clients). */
const LLM_MODEL_ID = "MiniMax-M2.7";

/** Public product model label for status APIs (no vendor string). */
export const FLASH_AI_MODEL = "flash-ai";

export type LlmRole = "system" | "user" | "assistant" | "tool";

export type LlmMessage = {
    role: LlmRole;
    content: string | null;
    tool_calls?: LlmToolCall[];
    tool_call_id?: string;
    name?: string;
};

export type LlmToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
};

export type LlmToolDef = {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
};

export type ChatCompletionResult = {
    content: string;
    tool_calls: LlmToolCall[];
    finish_reason: string | null;
    raw: unknown;
};

export function isFlashAiConfigured(): boolean {
    return Boolean(process.env.MINIMAX_API_KEY?.trim());
}

export function getLlmApiKey(): string | null {
    const key = process.env.MINIMAX_API_KEY?.trim();
    return key || null;
}

export class FlashAiNotConfiguredError extends Error {
    constructor() {
        super("Flash AI not configured — add via wrangler when ready.");
        this.name = "FlashAiNotConfiguredError";
    }
}

function requireKey(): string {
    const key = getLlmApiKey();
    if (!key) throw new FlashAiNotConfiguredError();
    return key;
}

export {
    stripThinkingArtifacts,
    extractJsonObject,
    resolveAssistantText,
    ThinkingStreamSanitizer,
};
export { formatDraftReadable } from "@/src/lib/ai/sanitize";

export async function chatCompletion(opts: {
    messages: LlmMessage[];
    tools?: LlmToolDef[];
    temperature?: number;
    max_completion_tokens?: number;
}): Promise<ChatCompletionResult> {
    const key = requireKey();
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: LLM_MODEL_ID,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.4,
            max_completion_tokens: opts.max_completion_tokens ?? 2048,
            reasoning_split: true,
            ...(opts.tools?.length ? { tools: opts.tools } : {}),
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[flash-ai] chat error", res.status, text.slice(0, 400));
        throw new Error(`Flash AI request failed (${res.status})`);
    }

    const json = (await res.json()) as {
        choices?: Array<{
            finish_reason?: string | null;
            message?: {
                content?: string | null;
                reasoning_content?: string | null;
                tool_calls?: LlmToolCall[];
            };
        }>;
    };

    const choice = json.choices?.[0];
    const message = choice?.message;
    // Prefer content; if empty, use stripped reasoning_content so JSON/text still lands.
    // resolveAssistantText never returns raw CoT tags.
    const content = resolveAssistantText(
        message?.content,
        message?.reasoning_content
    );
    return {
        content,
        tool_calls: message?.tool_calls ?? [],
        finish_reason: choice?.finish_reason ?? null,
        raw: json,
    };
}

/**
 * Stream chat completions as an SSE-compatible ReadableStream of text deltas.
 * Yields plain UTF-8 chunks of assistant content (thinking tags stripped).
 */
export async function streamChatCompletion(opts: {
    messages: LlmMessage[];
    tools?: LlmToolDef[];
    temperature?: number;
    max_completion_tokens?: number;
}): Promise<Response> {
    const key = requireKey();
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: LLM_MODEL_ID,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.4,
            max_completion_tokens: opts.max_completion_tokens ?? 2048,
            stream: true,
            reasoning_split: true,
            ...(opts.tools?.length ? { tools: opts.tools } : {}),
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[flash-ai] stream error", res.status, text.slice(0, 400));
        throw new Error(`Flash AI stream failed (${res.status})`);
    }

    return res;
}

/** Parse OpenAI-style SSE stream into sanitized text content deltas. */
export function parseSseContentStream(
    upstream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let lineBuffer = "";
    const thinkSanitizer = new ThinkingStreamSanitizer();

    return new ReadableStream({
        async start(controller) {
            const reader = upstream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    lineBuffer += decoder.decode(value, { stream: true });
                    const lines = lineBuffer.split("\n");
                    lineBuffer = lines.pop() ?? "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data:")) continue;
                        const data = trimmed.slice(5).trim();
                        if (!data || data === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(data) as {
                                choices?: Array<{
                                    delta?: {
                                        content?: string | null;
                                        reasoning_content?: string | null;
                                    };
                                }>;
                            };
                            // Only forward content; skip reasoning_content deltas
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                const safe = thinkSanitizer.push(delta);
                                if (safe) controller.enqueue(encoder.encode(safe));
                            }
                        } catch {
                            // skip malformed chunks
                        }
                    }
                }
                const tail = thinkSanitizer.flush();
                if (tail) controller.enqueue(encoder.encode(tail));
            } catch (err) {
                controller.error(err);
                return;
            }
            controller.close();
        },
    });
}
