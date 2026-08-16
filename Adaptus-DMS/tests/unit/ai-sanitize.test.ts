import { describe, expect, it } from "vitest";
import {
    extractJsonObject,
    resolveAssistantText,
    stripThinkingArtifacts,
} from "@/src/lib/ai/sanitize";

describe("extractJsonObject", () => {
    it("parses think-wrapped JSON after stripping CoT tags", () => {
        const raw = `<think>I will return JSON next.</think>
{"explanation":"Hot because [S1]","action":"Call today"}`;
        expect(extractJsonObject(raw)).toEqual({
            explanation: "Hot because [S1]",
            action: "Call today",
        });
    });

    it("recovers JSON trapped entirely inside think tags", () => {
        const raw = `<think>{"q":"honda civic","make":"Honda"}</think>`;
        expect(extractJsonObject(raw)).toEqual({
            q: "honda civic",
            make: "Honda",
        });
    });

    it("finds JSON after extra prose and markdown fences", () => {
        const raw = `Sure! Here is the payload:

\`\`\`json
{"q":"civic","min_year":2019}
\`\`\`

Hope that helps.`;
        expect(extractJsonObject(raw)).toEqual({
            q: "civic",
            min_year: 2019,
        });
    });

    it("strips trailing commas before closing braces and brackets", () => {
        const raw = `{"explanation":"ok","action":"call","tags":["a","b",],}`;
        expect(extractJsonObject(raw)).toEqual({
            explanation: "ok",
            action: "call",
            tags: ["a", "b"],
        });
    });

    it("skips an invalid first brace candidate and parses the next object", () => {
        const raw = `Prefix {not json} then {"body":"draft","subject":"Hi"}`;
        expect(extractJsonObject(raw)).toEqual({
            body: "draft",
            subject: "Hi",
        });
    });

    it("unwraps a top-level JSON array of one object", () => {
        const raw = `[{"explanation":"Warm [S2]","action":"Hold"}]`;
        expect(extractJsonObject(raw)).toEqual({
            explanation: "Warm [S2]",
            action: "Hold",
        });
    });
});

describe("resolveAssistantText", () => {
    it("uses stripped reasoning_content when content is empty", () => {
        const reasoning = `<think>hidden chain of thought</think>
{"q":"civic si"}`;
        const out = resolveAssistantText("", reasoning);
        expect(out).toContain('"q"');
        expect(out).toContain("civic si");
        expect(out.toLowerCase()).not.toContain("chain of thought");
        expect(out.toLowerCase()).not.toContain("<think>");
    });

    it("does not leak CoT when reasoning is think-only JSON", () => {
        const out = resolveAssistantText(
            "   ",
            `<think>{"explanation":"[S1] quote ready","action":"Quote"}</think>`
        );
        expect(JSON.parse(out)).toEqual({
            explanation: "[S1] quote ready",
            action: "Quote",
        });
        expect(out.toLowerCase()).not.toMatch(/think/);
    });

    it("prefers content over reasoning and still strips think tags", () => {
        const out = resolveAssistantText(
            `<think>ignore</think>Visible draft`,
            "secret reasoning blob"
        );
        expect(out).toBe("Visible draft");
        expect(out).not.toContain("secret");
    });

    it("returns empty rather than leaking untagged-empty think blocks", () => {
        expect(
            resolveAssistantText("", "<think>only chain of thought here</think>")
        ).toBe("");
    });
});

describe("stripThinkingArtifacts", () => {
    it("does not leave think tags in output used by the UI", () => {
        const out = stripThinkingArtifacts(
            "<thinking>cot</thinking>\nHello desk"
        );
        expect(out).toBe("Hello desk");
    });
});
