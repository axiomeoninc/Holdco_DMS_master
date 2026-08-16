/**
 * CI guard: VIN lookups on `vehicles` must be rooftop-scoped.
 *
 * Fails if `.from("vehicles")` is followed by `.eq("vin"` without
 * `dealership_id`, `applyTenantScope`, or `findVehicleByVinOrId`.
 * Also fails unprefixed `{vin}/` storage upserts.
 *
 *   node scripts/check-tenant-vin.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const ALLOW_FILES = new Set([
  path.join("src", "lib", "vehicle-lookup.ts"),
]);

const IGNORE_DIR = new Set(["node_modules", ".next", "dist", "coverage"]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIR.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length;
}

function precedingLines(content, index, n) {
  const start = content.lastIndexOf("\n", index);
  let from = start;
  for (let i = 0; i < n; i++) {
    const next = content.lastIndexOf("\n", from - 1);
    if (next < 0) {
      from = 0;
      break;
    }
    from = next;
  }
  return content.slice(from, index);
}

function followingLines(content, index, n) {
  let end = index;
  for (let i = 0; i < n; i++) {
    const next = content.indexOf("\n", end + 1);
    if (next < 0) {
      end = content.length;
      break;
    }
    end = next;
  }
  return content.slice(index, end);
}

const vinEqRe = /\.eq\(\s*(["'])vin\1/g;
const unprefixedUploadRe =
  /(?:folder\s*=\s*(?:vin|vehicle\.vin)|storagePath\s*=\s*`\$\{vin\}\/|`\$\{vin\}\/)/g;

const violations = [];

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");

  let m;
  vinEqRe.lastIndex = 0;
  while ((m = vinEqRe.exec(content))) {
    if (ALLOW_FILES.has(rel.replace(/\//g, path.sep)) || ALLOW_FILES.has(rel)) {
      continue;
    }
    const before = precedingLines(content, m.index, 40);
    const after = followingLines(content, m.index, 8);
    const window = before + after;
    const touchesVehicles =
      /\.from\(\s*(["'])vehicles\1/.test(window) ||
      /from\(\s*(["'])vehicles\1/.test(window);
    if (!touchesVehicles) continue;

    const rooftopScoped =
      /findVehicleByVinOrId/.test(window) ||
      /applyTenantScope/.test(window) ||
      /\.eq\(\s*(["'])dealership_id\1/.test(window);
    if (rooftopScoped) continue;

    violations.push({
      file: rel,
      line: lineOf(content, m.index),
      kind: "vin-eq-unscoped",
      snippet: content.split("\n")[lineOf(content, m.index) - 1].trim(),
    });
  }

  unprefixedUploadRe.lastIndex = 0;
  while ((m = unprefixedUploadRe.exec(content))) {
    if (!/upsert\s*:\s*true/.test(content)) continue;
    const nearby = precedingLines(content, m.index, 25) + followingLines(content, m.index, 15);
    if (!/\.upload\(/.test(nearby) && !/storagePath/.test(nearby)) continue;
    if (/vehicleStorageFolder/.test(nearby)) continue;
    if (/\.dealership_id\s*\?\s*`\$\{/.test(nearby)) {
      violations.push({
        file: rel,
        line: lineOf(content, m.index),
        kind: "unprefixed-storage-fallback",
        snippet: content.split("\n")[lineOf(content, m.index) - 1].trim(),
      });
    }
  }
}

if (violations.length) {
  console.error("Tenant VIN / storage guard failed:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.snippet}`);
  }
  process.exit(1);
}

console.log("check-tenant-vin: ok");
