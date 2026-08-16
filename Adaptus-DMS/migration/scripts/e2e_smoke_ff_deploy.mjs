/**
 * E2E smoke for FF SaaS trial deploy.
 * Usage: node migration/scripts/e2e_smoke_ff_deploy.mjs
 * Does not print secrets. Protects Nova floors 158/77/71.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const auditRoot = path.resolve(root, "../../migration/_sync_audit");

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
const BASE = process.env.SMOKE_BASE || "https://dms.adaptusgroup.ca";
const EMAIL = "f02_test_adaptus@adaptusgroup.ca";
const PASSWORD = process.env.SMOKE_PASSWORD || "AdaptusTest2026!CookieFlow";
const NOVA = "dd404bb6-3e64-43ae-9eb7-98095033c6cb";
const FLOORS = { vehicles: 158, sales_deals: 77, invoices: 71 };

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function countTable(table) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(
    `${url}/rest/v1/${table}?select=id&dealership_id=eq.${NOVA}`,
    {
      method: "HEAD",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
      },
    }
  );
  const cr = r.headers.get("content-range") || "";
  const total = Number((cr.split("/")[1] || "0").trim());
  return total;
}

async function pageStatus(path) {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return r.status;
}

async function main() {
  // Floors
  for (const [table, floor] of Object.entries(FLOORS)) {
    const n = await countTable(table);
    record(`floor:${table}`, n >= floor, `${n} (floor ${floor})`);
  }

  // Public pages
  for (const p of [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ]) {
    const s = await pageStatus(p);
    record(`page:${p}`, s === 200, `status ${s}`);
  }

  // Protected redirect
  const dash = await pageStatus("/dashboard");
  record("page:/dashboard unauth", dash === 307 || dash === 302, `status ${dash}`);

  // Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, rememberMe: true }),
  });
  const setCookie = loginRes.headers.getSetCookie?.() || [];
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const loginBody = await loginRes.json().catch(() => ({}));
  record(
    "auth:login",
    loginRes.status === 200 && Boolean(cookieHeader),
    `status ${loginRes.status}`
  );

  if (loginRes.status !== 200) {
    console.error("Login failed; skipping authenticated matrix", loginBody?.error || "");
  } else {
    const authed = async (path, method = "GET") => {
      const r = await fetch(`${BASE}${path}`, {
        method,
        headers: { Cookie: cookieHeader },
        redirect: "manual",
      });
      return r;
    };

    const me = await authed("/api/me");
    const meJson = await me.json().catch(() => ({}));
    record(
      "api:/api/me",
      me.status === 200 && meJson?.data?.subscription?.status === "active",
      `status ${me.status}; sub=${meJson?.data?.subscription?.status}; soft_locked=${meJson?.data?.subscription?.soft_locked}`
    );

    const matrix = [
      "/api/vehicles?limit=1",
      "/api/customers?limit=1",
      "/api/leads?limit=1",
      "/api/deals?limit=1",
      "/api/invoices?limit=1",
      "/api/expenses?limit=1",
      "/api/quotations?limit=1",
      "/api/tasks?limit=1",
      "/api/tickets?limit=1",
      "/api/users?limit=1",
      "/dashboard",
      "/inventory",
      "/leads",
      "/customers",
      "/deals",
      "/invoices",
      "/expenses",
      "/quotations",
      "/tasks",
      "/tickets",
      "/calendar",
      "/reports",
      "/users",
      "/dealerships",
      "/social",
      "/settings",
    ];

    for (const path of matrix) {
      const r = await authed(path);
      const ok = r.status === 200;
      record(`auth:${path}`, ok, `status ${r.status}`);
    }

    // Register API validation (no side-effect dealership if validation fails early)
    const regBad = await fetch(`${BASE}/api/auth/register-dealership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealership_name: "" }),
    });
    record("api:register-dealership validation", regBad.status === 400, `status ${regBad.status}`);

    const forgot = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL }),
    });
    const forgotJson = await forgot.json().catch(() => ({}));
    record(
      "api:forgot-password",
      forgot.status === 200,
      `status ${forgot.status}; warning=${forgotJson.warning || "none"}`
    );
  }

  // Domain probe
  let ffStatus = "blocked";
  try {
    const r = await fetch("https://app.flashfender.com/login", {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    ffStatus = String(r.status);
    record("domain:app.flashfender.com/login", r.status === 200, `status ${r.status}`);
  } catch (e) {
    record(
      "domain:app.flashfender.com/login",
      false,
      `unreachable: ${e instanceof Error ? e.message : "error"}`
    );
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    base: BASE,
    tip: null,
    floors: Object.fromEntries(
      await Promise.all(
        Object.keys(FLOORS).map(async (t) => [t, await countTable(t)])
      )
    ),
    flashfender_domain: ffStatus,
    pass: results.filter((r) => r.ok).length,
    fail: failed.length,
    results,
  };

  const outPath = path.join(auditRoot, "E2E_SMOKE_FF_DEPLOY_raw.json");
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`PASS ${summary.pass} / FAIL ${summary.fail}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
