/**
 * Phase 0 route audit: pages + APIs vs static in-app link/API targets.
 * Writes handoff/signoffs/ROUTE_404_AUDIT_MATRIX.md (no secrets).
 *
 * Usage: node scripts/audit-routes.mjs
 * npm:   npm run audit:routes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_ALLOWLIST,
  PAGE_ALLOWLIST,
  fileRelToUrl,
  isFullyStatic,
  matchesKnown,
  normalizePath,
  pathToPattern,
} from "./lib/audit-route-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const APP = path.join(SRC, "app");
const OUT = path.join(ROOT, "handoff", "signoffs", "ROUTE_404_AUDIT_MATRIX.md");

const IGNORE_DIR_NAMES = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

function walk(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIR_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, predicate, acc);
    else if (predicate(full, ent.name)) acc.push(full);
  }
  return acc;
}

function fileToUrl(filePath, kind) {
  const rel = path.relative(APP, filePath).replace(/\\/g, "/");
  return fileRelToUrl(rel, kind);
}

function extractFromSource(content, fileRel) {
  const found = [];
  const push = (raw, kind) => {
    const n = normalizePath(raw);
    if (!n) return;
    found.push({ path: n, kind, file: fileRel });
  };

  // href="/x" or href={"/x"} or href: "/x" (nav objects)
  const hrefEqRe = /\bhref\s*=\s*(?:\{\s*)?["'`](\/[^"'`]*?)["'`]/g;
  let m;
  while ((m = hrefEqRe.exec(content))) push(m[1], "href");

  const hrefColonRe = /\bhref\s*:\s*["'`](\/[^"'`]*?)["'`]/g;
  while ((m = hrefColonRe.exec(content))) push(m[1], "href");

  const toRe = /\bto\s*=\s*["'`](\/[^"'`]*?)["'`]/g;
  while ((m = toRe.exec(content))) push(m[1], "to");

  const pushRe = /\b(?:router\.(?:push|replace))\s*\(\s*["'`](\/[^"'`]*?)["'`]/g;
  while ((m = pushRe.exec(content))) push(m[1], "router");

  const locRe =
    /\b(?:location\.(?:assign|replace)\s*\(\s*["'`](\/[^"'`]*?)["'`]|location\.href\s*=\s*["'`](\/[^"'`]*?)["'`])/g;
  while ((m = locRe.exec(content))) push(m[1] || m[2], "location");

  const redRe = /\bredirect\s*\(\s*["'`](\/[^"'`]*?)["'`]/g;
  while ((m = redRe.exec(content))) push(m[1], "redirect");

  const pathKeyRe = /\b(?:path|pathname|url|route)\s*:\s*["'`](\/[^"'`]*?)["'`]/g;
  while ((m = pathKeyRe.exec(content))) push(m[1], "path-key");

  const apiRe = /\b(?:fetch|apiFetch)\s*\(\s*["'`](\/api\/[^"'`]*?)["'`]/g;
  while ((m = apiRe.exec(content))) push(m[1], "api-call");

  const apiLitRe = /["'`](\/api\/[a-zA-Z0-9/_-]+)["'`]/g;
  while ((m = apiLitRe.exec(content))) {
    if (m[1].includes("[")) continue;
    push(m[1], "api-literal");
  }

  // Breadcrumb / command palette style: title paired with absolute path strings
  // Catch remaining quoted absolute app paths (conservative: letter after /)
  const barePageRe = /["'`](\/[a-zA-Z][a-zA-Z0-9/_-]*)["'`]/g;
  while ((m = barePageRe.exec(content))) {
    const p = m[1];
    if (p.startsWith("/api")) continue;
    if (/\./.test(p)) continue;
    push(p, "string-literal");
  }

  return found;
}

function collectPages() {
  const files = walk(APP, (f, name) => name === "page.tsx");
  const urls = new Set();
  const patterns = new Set();
  const rows = [];
  for (const f of files) {
    const url = fileToUrl(f, "page");
    urls.add(url);
    const pat = pathToPattern(url);
    patterns.add(pat);
    rows.push({ file: path.relative(ROOT, f).replace(/\\/g, "/"), url, pattern: pat });
  }
  return { urls, patterns: [...patterns], rows };
}

function collectApis() {
  const apiRoot = path.join(APP, "api");
  const files = walk(apiRoot, (f, name) => name === "route.ts" || name === "route.js");
  const urls = new Set();
  const patterns = new Set();
  const rows = [];
  for (const f of files) {
    const url = fileToUrl(f, "api");
    urls.add(url);
    const pat = pathToPattern(url);
    patterns.add(pat);
    rows.push({ file: path.relative(ROOT, f).replace(/\\/g, "/"), url, pattern: pat });
  }
  return { urls, patterns: [...patterns], rows };
}

function collectReferences() {
  const files = walk(SRC, (f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f));
  const pageRefs = [];
  const apiRefs = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    let content;
    try {
      content = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (content.length > 2_000_000) continue;
    for (const e of extractFromSource(content, rel)) {
      if (e.path.startsWith("/api/") || e.path === "/api") apiRefs.push(e);
      else pageRefs.push(e);
    }
  }
  return { pageRefs, apiRefs };
}

function uniqueByPath(refs) {
  const map = new Map();
  for (const r of refs) {
    const cur = map.get(r.path);
    if (!cur) map.set(r.path, { path: r.path, kinds: new Set([r.kind]), files: new Set([r.file]) });
    else {
      cur.kinds.add(r.kind);
      cur.files.add(r.file);
    }
  }
  return [...map.values()].map((x) => ({
    path: x.path,
    kinds: [...x.kinds].sort(),
    files: [...x.files].sort(),
  }));
}

function main() {
  const pages = collectPages();
  const apis = collectApis();
  const { pageRefs, apiRefs } = collectReferences();

  const uniqPages = uniqueByPath(pageRefs.filter((r) => isFullyStatic(r.path)));
  const uniqApis = uniqueByPath(apiRefs.filter((r) => isFullyStatic(r.path)));

  const orphanPages = uniqPages.filter(
    (r) =>
      !PAGE_ALLOWLIST.has(r.path) &&
      !matchesKnown(r.path, pages.urls, pages.patterns)
  );
  const orphanApis = uniqApis.filter(
    (r) =>
      !API_ALLOWLIST.has(r.path) &&
      !matchesKnown(r.path, apis.urls, apis.patterns)
  );
  const allowlistedPageHits = uniqPages.filter((r) => PAGE_ALLOWLIST.has(r.path));
  const allowlistedApiHits = uniqApis.filter((r) => API_ALLOWLIST.has(r.path));

  const referencedPageSet = new Set(uniqPages.map((r) => r.path));
  const unreferencedPages = pages.rows
    .filter((p) => isFullyStatic(p.url))
    .filter((p) => {
      if (referencedPageSet.has(p.url)) return false;
      for (const r of uniqPages) {
        if (matchesKnown(r.path, new Set([p.url]), [p.pattern])) return false;
      }
      return true;
    });

  const now = new Date().toISOString();
  const lines = [];
  lines.push("# Route 404 Audit Matrix");
  lines.push("");
  lines.push("Generated: `" + now + "`");
  lines.push("Script: `scripts/audit-routes.mjs`");
  lines.push("");
  lines.push(
    "Static inventory only. Dynamic `[param]` targets are ignored when a matching page/API pattern exists. No secrets."
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|------:|");
  lines.push("| App pages (`page.tsx`) | " + pages.rows.length + " |");
  lines.push("| API routes (`route.ts`) | " + apis.rows.length + " |");
  lines.push("| Unique static page hrefs found | " + uniqPages.length + " |");
  lines.push("| Unique static API paths found | " + uniqApis.length + " |");
  lines.push("| **Orphan page hrefs** (no matching page) | **" + orphanPages.length + "** |");
  lines.push("| **Orphan API calls** (no matching route) | **" + orphanApis.length + "** |");
  lines.push("| Allowlisted page strings (not orphans) | " + allowlistedPageHits.length + " |");
  lines.push("| Allowlisted API prefixes (not orphans) | " + allowlistedApiHits.length + " |");
  lines.push("| Static pages with no in-src reference (info) | " + unreferencedPages.length + " |");
  lines.push("");

  lines.push("## Orphan page hrefs");
  lines.push("");
  if (orphanPages.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Path | Kinds | Example sources |");
    lines.push("|------|-------|-----------------|");
    for (const o of orphanPages.sort((a, b) => a.path.localeCompare(b.path))) {
      const srcs = o.files.slice(0, 5).map((f) => "`" + f + "`").join(", ");
      const more = o.files.length > 5 ? " (+" + (o.files.length - 5) + ")" : "";
      lines.push("| `" + o.path + "` | " + o.kinds.join(", ") + " | " + srcs + more + " |");
    }
  }
  lines.push("");

  lines.push("## Orphan API paths");
  lines.push("");
  if (orphanApis.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Path | Kinds | Example sources |");
    lines.push("|------|-------|-----------------|");
    for (const o of orphanApis.sort((a, b) => a.path.localeCompare(b.path))) {
      const srcs = o.files.slice(0, 5).map((f) => "`" + f + "`").join(", ");
      const more = o.files.length > 5 ? " (+" + (o.files.length - 5) + ")" : "";
      lines.push("| `" + o.path + "` | " + o.kinds.join(", ") + " | " + srcs + more + " |");
    }
  }
  lines.push("");

  lines.push("## Allowlist (documented non-orphans)");
  lines.push("");
  lines.push("Page allowlist: " + [...PAGE_ALLOWLIST].map((p) => "`" + p + "`").join(", "));
  lines.push("");
  lines.push("API allowlist: " + [...API_ALLOWLIST].map((p) => "`" + p + "`").join(", "));
  lines.push("");

  lines.push("## Known pages");
  lines.push("");
  lines.push("| URL | Pattern | File |");
  lines.push("|-----|---------|------|");
  for (const r of pages.rows.sort((a, b) => a.url.localeCompare(b.url))) {
    lines.push("| `" + r.url + "` | `" + r.pattern + "` | `" + r.file + "` |");
  }
  lines.push("");

  lines.push("## Known API routes");
  lines.push("");
  lines.push("| URL | Pattern | File |");
  lines.push("|-----|---------|------|");
  for (const r of apis.rows.sort((a, b) => a.url.localeCompare(b.url))) {
    lines.push("| `" + r.url + "` | `" + r.pattern + "` | `" + r.file + "` |");
  }
  lines.push("");

  lines.push("## Unreferenced static pages (informational)");
  lines.push("");
  lines.push(
    "These pages exist but no static href/push/redirect to them was found in `src/`. Not necessarily bugs."
  );
  lines.push("");
  if (unreferencedPages.length === 0) {
    lines.push("_None._");
  } else {
    for (const p of unreferencedPages.sort((a, b) => a.url.localeCompare(b.url))) {
      lines.push("- `" + p.url + "` <- `" + p.file + "`");
    }
  }
  lines.push("");
  lines.push("---");
  lines.push(
    "Phase 0 of Deep 404 Swarm. Fix orphans in later lanes; do not treat this file as a deploy artifact."
  );
  lines.push("");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");

  console.log("Wrote " + path.relative(ROOT, OUT).replace(/\\/g, "/"));
  console.log(
    JSON.stringify(
      {
        pages: pages.rows.length,
        apis: apis.rows.length,
        staticPageHrefs: uniqPages.length,
        staticApiPaths: uniqApis.length,
        orphanPages: orphanPages.length,
        orphanApis: orphanApis.length,
        topOrphanPages: orphanPages
          .sort((a, b) => a.path.localeCompare(b.path))
          .slice(0, 25)
          .map((o) => o.path),
        topOrphanApis: orphanApis
          .sort((a, b) => a.path.localeCompare(b.path))
          .slice(0, 25)
          .map((o) => o.path),
        allowlistedPages: allowlistedPageHits.map((r) => r.path),
        allowlistedApis: allowlistedApiHits.map((r) => r.path),
      },
      null,
      2
    )
  );
}

main();
