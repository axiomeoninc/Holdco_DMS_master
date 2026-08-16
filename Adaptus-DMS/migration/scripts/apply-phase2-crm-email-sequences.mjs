/**
 * Apply phase2_crm_email_sequences.sql via Supabase Management API.
 * Usage: node migration/scripts/apply-phase2-crm-email-sequences.mjs
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
const sqlPath = path.join(
  root,
  "src/app/supabase/migrations/phase2_crm_email_sequences.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const endpoints = [
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  `https://api.supabase.com/v1/projects/${ref}/db/query`,
];

async function run() {
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
      console.log("Migration applied OK");
      return;
    }
  }
  process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
