/**
 * Apply the FlashFender Tier 1/Tier 2 additive migrations via Supabase
 * Management API (same tooling pattern as apply-phase2-crm-email-sequences.mjs
 * and apply-saas-trial-migration.mjs).
 *
 * Usage: node migration/scripts/apply-flashfender-migrations.mjs
 * Reads SUPABASE_ACCESS_TOKEN from .env.local; targets the repo's project ref.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function loadEnv() {
  const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = "zwfeitodxikdwymkieai";

const migrations = [
  "t1_esign_payments_retention.sql",
  "t1_sms_webhooks_api.sql",
  "tier2_ai_gov_credit_afterhours.sql",
  "t3_multi_location.sql",
  "t3_service_module.sql",
  "t3_auction_sourcing.sql",
  "t3_review_automation.sql",
];

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const endpoints = [
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  `https://api.supabase.com/v1/projects/${ref}/db/query`,
];

async function apply(name) {
  const sqlPath = path.join(root, "src/app/supabase/migrations", name);
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log(`\n=== Applying ${name} (${sql.length} bytes) ===`);
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    console.log(endpoint, res.status, text.slice(0, 800));
    if (res.ok) {
      console.log(`Migration applied OK: ${name}`);
      return true;
    }
    if (res.status !== 404) {
      break;
    }
  }
  return false;
}

let failed = false;
for (const name of migrations) {
  const ok = await apply(name);
  if (!ok) failed = true;
}

if (failed) {
  console.error("\nOne or more migrations failed.");
  process.exit(1);
}
console.log("\nAll FlashFender migrations applied.");
