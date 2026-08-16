/**
 * FlashFender DMS — k6 staging smoke (low VU).
 *
 * Targets: BASE_URL /api/health + /login only.
 *
 * REFUSE PRODUCTION SOAK / LOAD:
 * - Do NOT point BASE_URL at https://app.flashfender.com (or other prod hosts)
 *   for soak, stress, or high-VU runs.
 * - This script is staging-only smoke: few VUs, short duration, schedule/dispatch CI.
 * - Production soak is explicitly out of scope for v1 QA.
 *
 * Run:
 *   k6 run -e BASE_URL=https://your-staging.example tests/perf/smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "").replace(/\/$/, "");

if (!BASE_URL) {
  throw new Error("BASE_URL is required (staging only — never prod soak)");
}

const PROD_HOST_RE =
  /(^https?:\/\/)?(app\.)?flashfender\.com\/?$/i;
const allowProdSmoke = __ENV.ALLOW_PROD_SMOKE === "true";

if (PROD_HOST_RE.test(BASE_URL) && !allowProdSmoke) {
  throw new Error(
    "Refusing k6 against production host. Use STAGING_BASE_URL only. " +
      "Prod soak is not allowed. (Set ALLOW_PROD_SMOKE=true only for a one-off health probe, never soak.)"
  );
}

export const options = {
  vus: 2,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<5000"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "health" },
  });
  check(health, {
    "health status 200": (r) => r.status === 200,
    "health body ok": (r) => {
      try {
        const body = r.json();
        return body && body.ok === true;
      } catch {
        return false;
      }
    },
  });

  const loginPage = http.get(`${BASE_URL}/login`, {
    tags: { name: "login_page" },
  });
  check(loginPage, {
    "login page status 200": (r) => r.status === 200,
  });

  sleep(1);
}
