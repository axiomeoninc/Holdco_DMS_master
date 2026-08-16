#!/usr/bin/env node
/**
 * AI UX critic (heuristic + optional LLM).
 *
 * Intended for PRs that touch Storybook stories or gold UI components.
 * Writes a markdown critique suitable for a GitHub PR comment.
 *
 * Env:
 *   AI_UX_CRITIC_MODEL_URL  — optional LLM endpoint (OpenAI-compatible)
 *   AI_UX_CRITIC_API_KEY    — optional bearer token for the endpoint
 *   AI_UX_CRITIC_MODEL      — optional model id (default: gpt-4o-mini)
 *   GITHUB_STEP_SUMMARY     — when set (GHA), appends the report
 *   AI_UX_CRITIC_OUT        — optional file path for the markdown report
 *
 * Without LLM credentials, posts a deterministic gold-token heuristic checklist.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GOLD_PRIMARY = "#00AEEF";
const UI_GLOBS = [
  "src/components/ui/",
  "src/components/ImpersonationBanner",
  ".storybook/",
  "src/**/*.stories.tsx",
];

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function changedUiPaths() {
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "HEAD~1";
  const diff = sh(`git diff --name-only ${base}...HEAD`);
  const files = diff
    ? diff.split("\n").filter(Boolean)
    : sh("git diff --name-only HEAD").split("\n").filter(Boolean);

  return files.filter((f) =>
    UI_GLOBS.some((g) => {
      if (g.includes("*")) {
        return f.endsWith(".stories.tsx") || f.includes("/ui/");
      }
      return f.includes(g.replace(/\/$/, ""));
    })
  );
}

function heuristicReport(files) {
  const lines = [
    "## AI UX critic (gold tokens)",
    "",
    `_Heuristic pass — primary brand ${GOLD_PRIMARY}. Does **not** replace axe, Chromatic, or Lighthouse._`,
    "",
    "### Changed UI / story paths",
    "",
  ];

  if (files.length === 0) {
    lines.push("- _(no matching story/UI diffs detected)_");
  } else {
    for (const f of files) lines.push(`- \`${f}\``);
  }

  lines.push(
    "",
    "### Checklist vs FlashFender gold",
    "",
    "- [ ] Hierarchy: one clear primary action per surface; secondary actions quieter",
    "- [ ] Spacing: hairline borders, quiet radii (`rounded-lg`/`md`); avoid decorative orbs",
    `- [ ] Contrast: interactive focus uses \`ring\` / ${GOLD_PRIMARY}; text meets AA on canvas`,
    "- [ ] Focus order: dialogs trap focus; banners keep Exit reachable when label truncates",
    "- [ ] Motion: CSS-only polish ≤200ms; no kit deps (Magic/Aceternity inspiration only)",
    "- [ ] Density: DataTable stays 13px body / sticky thead; empty + skeleton states covered",
    "",
    "### Storybook coverage expectation",
    "",
    "- Button variants + loading + focus ring",
    "- ConfirmDialog open / destructive",
    "- ImpersonationBanner long-name overflow",
    "- DataTable empty / skeleton / rows",
    "- Platform hub / StatCard grid",
    ""
  );

  return lines.join("\n");
}

async function maybeLlmEnrich(report, files) {
  const url = process.env.AI_UX_CRITIC_MODEL_URL;
  const key = process.env.AI_UX_CRITIC_API_KEY;
  if (!url || !key) {
    return (
      report +
      "\n### LLM status\n\n- Placeholder: set `AI_UX_CRITIC_MODEL_URL` + `AI_UX_CRITIC_API_KEY` to append model critique.\n"
    );
  }

  const model = process.env.AI_UX_CRITIC_MODEL || "gpt-4o-mini";
  const prompt = [
    "You are a senior product designer reviewing FlashFender DMS gold UI.",
    `Brand primary is ${GOLD_PRIMARY}. Prefer hierarchy, spacing, contrast, focus order.`,
    "Be concise. Bullet findings only. No code dumps.",
    `Changed files:\n${files.map((f) => `- ${f}`).join("\n") || "(none)"}`,
  ].join("\n");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "UX critic for React/Tailwind SaaS admin UI." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      return report + `\n### LLM status\n\n- Request failed: HTTP ${res.status}\n`;
    }

    const data = await res.json();
    const content =
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      "(empty model response)";

    return report + "\n### Model critique\n\n" + content + "\n";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return report + `\n### LLM status\n\n- Request error: ${msg}\n`;
  }
}

async function main() {
  const files = changedUiPaths();
  let report = heuristicReport(files);
  report = await maybeLlmEnrich(report, files);

  const outPath =
    process.env.AI_UX_CRITIC_OUT ||
    path.join(ROOT, "handoff", "ai-ux-critic-latest.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, "utf8");
  process.stdout.write(report + "\n");

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
