/**
 * Shared Flash AI output sanitizers (safe for client + server).
 * Strips model chain-of-thought tags so drafts never leak thinking markup.
 */

const THINK_OPEN = String.raw`<\s*(?:think|thinking|redacted_reasoning|reasoning)\s*>`;
const THINK_CLOSE = String.raw`<\s*/\s*(?:think|thinking|redacted_reasoning|reasoning)\s*>`;
const THINK_BLOCK_RE = new RegExp(
    `${THINK_OPEN}[\\s\\S]*?(?:${THINK_CLOSE}|$)`,
    "gi"
);
const THINK_TAG_RE = new RegExp(
    `</?\\s*(?:think|thinking|redacted_reasoning|reasoning)\\s*>`,
    "gi"
);
/** Some hosts emit think spans with atypical brackets. */
const ALT_THINK_BLOCK_RE =
    /(?:^|\n)\s*(?:thinking|reasoning)\s*:\s*[\s\S]*?(?=\n\s*(?:#{1,3}\s|[A-Z][a-z].{20,}|\*\*|$))/gi;

/** Remove think/thinking blocks and leftover tags from model output. */
export function stripThinkingArtifacts(text: string): string {
    if (!text) return "";
    let out = text;
    // Complete or trailing unclosed think blocks (greedy to end if no close)
    out = out.replace(THINK_BLOCK_RE, "");
    // Orphan tags
    out = out.replace(THINK_TAG_RE, "");
    // If an open-looking remnant remains mid-string, drop from there
    const remnant = out.search(/<\s*(?:think|thinking|redacted_reasoning|reasoning)\b/i);
    if (remnant >= 0) {
        out = out.slice(0, remnant);
    }
    // Drop leading "Thinking:" style dumps when they dominate the start
    if (/^\s*(?:thinking|reasoning)\s*:/i.test(out) && out.length > 400) {
        out = out.replace(ALT_THINK_BLOCK_RE, "");
    }
    return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Incremental sanitizer for streamed deltas.
 * Buffers across chunk boundaries so open think spans never reach the UI.
 */
export class ThinkingStreamSanitizer {
    private buffer = "";
    private inThink = false;

    push(chunk: string): string {
        if (!chunk) return "";
        this.buffer += chunk;
        return this.drain(false);
    }

    flush(): string {
        return this.drain(true);
    }

    private drain(force: boolean): string {
        if (this.inThink) {
            const closeRe = new RegExp(THINK_CLOSE, "i");
            const closeMatch = closeRe.exec(this.buffer);
            if (!closeMatch) {
                if (force) {
                    this.buffer = "";
                    this.inThink = false;
                    return "";
                }
                // Keep holding while inside think
                if (this.buffer.length > 20000) {
                    this.buffer = this.buffer.slice(-500);
                }
                return "";
            }
            this.buffer = this.buffer.slice(closeMatch.index + closeMatch[0].length);
            this.inThink = false;
        }

        this.buffer = this.buffer.replace(
            new RegExp(`${THINK_OPEN}[\\s\\S]*?${THINK_CLOSE}`, "gi"),
            ""
        );

        const openRe = new RegExp(THINK_OPEN, "i");
        const openMatch = openRe.exec(this.buffer);
        if (openMatch && openMatch.index !== undefined) {
            const safe = this.buffer.slice(0, openMatch.index);
            this.buffer = this.buffer.slice(openMatch.index + openMatch[0].length);
            this.inThink = true;
            if (force) {
                // Discard remaining think buffer
                this.buffer = "";
                this.inThink = false;
                return stripThinkingArtifacts(safe);
            }
            // Recurse to continue draining after the open tag
            const more = this.drain(false);
            return stripThinkingArtifacts(safe + more);
        }

        if (force) {
            const out = stripThinkingArtifacts(this.buffer);
            this.buffer = "";
            return out;
        }

        // Hold a short tail that might be an incomplete opening tag
        const holdLen = 48;
        if (this.buffer.length <= holdLen) {
            if (/<\s*(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i.test(this.buffer)) {
                return "";
            }
            if (/<\s*(?:r(?:e(?:a(?:s(?:o(?:n(?:i(?:n(?:g)?)?)?)?)?)?)?)?)?$/i.test(this.buffer)) {
                return "";
            }
            const out = this.buffer;
            this.buffer = "";
            return stripThinkingArtifacts(out);
        }

        const emit = this.buffer.slice(0, -holdLen);
        this.buffer = this.buffer.slice(-holdLen);
        if (!/<\s*[^>]*$/i.test(this.buffer)) {
            const more = this.buffer;
            this.buffer = "";
            return stripThinkingArtifacts(emit + more);
        }
        return stripThinkingArtifacts(emit);
    }
}

/** Remove every markdown fence (not only a single start/end pair). */
function stripCodeFences(text: string): string {
    return text.replace(/```(?:json|javascript|js|ts)?\s*/gi, "").replace(/```/g, "");
}

/** Drop trailing commas before `}` / `]` without touching commas inside strings. */
function stripTrailingCommas(jsonish: string): string {
    let out = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < jsonish.length; i++) {
        const ch = jsonish[i]!;
        if (inString) {
            out += ch;
            if (escape) {
                escape = false;
            } else if (ch === "\\") {
                escape = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            out += ch;
            continue;
        }
        if (ch === ",") {
            let j = i + 1;
            while (j < jsonish.length && /\s/.test(jsonish[j]!)) j++;
            if (jsonish[j] === "}" || jsonish[j] === "]") {
                continue;
            }
        }
        out += ch;
    }
    return out;
}

function unwrapSingleObjectArray(value: unknown): unknown {
    if (
        Array.isArray(value) &&
        value.length === 1 &&
        value[0] !== null &&
        typeof value[0] === "object" &&
        !Array.isArray(value[0])
    ) {
        return value[0];
    }
    return value;
}

function tryParseJsonish(slice: string): unknown {
    return unwrapSingleObjectArray(
        JSON.parse(stripTrailingCommas(slice.trim())) as unknown
    );
}

function balancedSlices(
    text: string,
    open: "{" | "[",
    close: "}" | "]"
): string[] {
    const slices: string[] = [];
    for (let start = 0; start < text.length; start++) {
        if (text[start] !== open) continue;
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < text.length; i++) {
            const ch = text[i]!;
            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch === "\\") {
                    escape = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }
            if (ch === '"') {
                inString = true;
            } else if (ch === open) {
                depth++;
            } else if (ch === close) {
                depth--;
                if (depth === 0) {
                    slices.push(text.slice(start, i + 1));
                    break;
                }
            }
        }
    }
    return slices;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parse JSON from already-cleaned text: whole string, then every `{...}` / `[...]`. */
function parseJsonObjectFromText(text: string): unknown {
    const cleaned = stripCodeFences(text).trim();
    if (!cleaned) {
        throw new Error("No JSON object found");
    }

    try {
        const parsed = tryParseJsonish(cleaned);
        if (isPlainObject(parsed)) return parsed;
        const unwrapped = unwrapSingleObjectArray(parsed);
        if (isPlainObject(unwrapped)) return unwrapped;
    } catch {
        // fall through to candidate scan
    }

    for (const slice of balancedSlices(cleaned, "{", "}")) {
        try {
            const parsed = tryParseJsonish(slice);
            if (isPlainObject(parsed)) return parsed;
        } catch {
            // try the next `{...}` candidate (model often dumps prose then JSON)
        }
    }

    for (const slice of balancedSlices(cleaned, "[", "]")) {
        try {
            const parsed = tryParseJsonish(slice);
            if (isPlainObject(parsed)) return parsed;
        } catch {
            continue;
        }
    }

    throw new Error("No JSON object found");
}

/**
 * Prefer `content`; if empty, use stripped `reasoning_content`.
 * Never returns raw chain-of-thought tags. If the only payload is JSON
 * trapped inside think tags, stringify that object (not the CoT).
 */
export function resolveAssistantText(
    content?: string | null,
    reasoningContent?: string | null
): string {
    const fromContent = stripThinkingArtifacts(content ?? "");
    if (fromContent) return fromContent;
    const fromReasoning = stripThinkingArtifacts(reasoningContent ?? "");
    if (fromReasoning) return fromReasoning;
    for (const blob of [content ?? "", reasoningContent ?? ""]) {
        if (!blob.trim()) continue;
        try {
            const obj = parseJsonObjectFromText(blob);
            if (isPlainObject(obj)) return JSON.stringify(obj);
        } catch {
            continue;
        }
    }
    return "";
}

/**
 * Strip fences + thinking, then parse a JSON object.
 * Scans every `{...}` candidate, strips trailing commas, unwraps a
 * single-object array, and will read JSON trapped inside think tags.
 * Throws if no parseable object is found.
 */
export function extractJsonObject(text: string): unknown {
    const stripped = stripThinkingArtifacts(text);
    try {
        return parseJsonObjectFromText(stripped);
    } catch {
        // JSON sometimes lives only inside think/reasoning wrappers
        return parseJsonObjectFromText(text);
    }
}

/** Normalize draft text into readable paragraphs for UI insertion. */
export function formatDraftReadable(text: string): string {
    const cleaned = stripThinkingArtifacts(text);
    if (!cleaned) return "";
    return cleaned
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
