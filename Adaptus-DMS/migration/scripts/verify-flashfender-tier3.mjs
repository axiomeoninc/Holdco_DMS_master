/**
 * Verify FlashFender Tier 3 schema landed on the repo's Supabase project.
 * Same tooling pattern as apply-flashfender-migrations.mjs: reads
 * SUPABASE_ACCESS_TOKEN from .env.local and POSTs SQL to the Management API.
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

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const query = `
select 'table' as kind, table_name as name, null as detail
from information_schema.tables
where table_schema = 'public'
  and table_name in ('locations', 'service_records', 'review_requests')
union all
select 'column', table_name || '.' || column_name,
       data_type || ' (' || coalesce(column_default, 'no default') || ')'
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'vehicles' and column_name in ('location_id','source_kind','auction_venue','auction_lot_number','auction_sale_date','comp_notes'))
    or (table_name = 'purchase_from_public' and column_name in ('location_id','source_kind','auction_venue','auction_lot_number','auction_sale_date','comp_notes'))
    or (table_name = 'customers' and column_name in ('location_id','service_contact_consent','service_contact_consent_at'))
    or (table_name = 'sales_deals' and column_name = 'location_id')
    or (table_name = 'leads' and column_name = 'location_id'))
order by 1, 2;
`;

const endpoints = [
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  `https://api.supabase.com/v1/projects/${ref}/db/query`,
];

let done = false;
for (const endpoint of endpoints) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  console.log(endpoint, res.status);
  if (res.ok) {
    const rows = JSON.parse(text);
    console.log(JSON.stringify(rows, null, 2));
    done = true;
    break;
  }
  console.log(text.slice(0, 800));
}

if (!done) {
  process.exit(1);
}
