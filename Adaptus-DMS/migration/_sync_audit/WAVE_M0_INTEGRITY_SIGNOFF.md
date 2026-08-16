# Wave M0 Integrity Signoff

**Stamp:** 2026-08-04T05:53:42-07:00  
**Todo:** `wave-m0-integrity`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com · worker `flashfender-dms` · CF account `9269f304c042e14181e08bf8ee7aa4f9`  
**Supabase:** `zwfeitodxikdwymkieai`  
**Nova dealership:** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Stack:** Next.js + Supabase + Cloudflare OpenNext (no Prisma rewrite)  
**Git tip (local working tree):** `000e4014373149e0333619695da1a5d6d66f3d3a` (+ uncommitted M0 fixes)

---

## Scope completed (code)

| Item | Status | Notes |
|------|--------|-------|
| Reports API `dealership_id` scoping | **DONE** | All report types (`summary`, `sales`, `inventory`, `financial`, `leads`, `expenses`) resolve caller dealership and filter with `.eq("dealership_id", …)` unless `is_platform_admin` |
| Expenses report date filters | **DONE** | `start_date` / `end_date` now applied via `.gte/.lte("expense_date", …)`; previously ignored |
| Invoice POST `tax_rate` / `package_name` | **DONE** | Persisted on create; `line_items` included when provided (schema already used by PUT whitelist) |
| `tsc --noEmit` | **PASS** | Exit 0 after M0 edits |
| Hillz / Nova data | **UNTOUCHED** | No DB mutations, seeds, or floor destruction |

---

## Files changed (this wave)

- `src/app/api/reports/route.ts` — tenant scope + expenses date honor
- `src/app/api/invoices/route.ts` — POST persists `tax_rate`, `package_name`, optional `line_items`
- `migration/_sync_audit/WAVE_M0_INTEGRITY_SIGNOFF.md` (this file)
- Mirror: `DMSDATA/migration/_sync_audit/WAVE_M0_INTEGRITY_SIGNOFF.md`

---

## Deploy Phase 2 A/B/C + M0

| Field | Value |
|-------|-------|
| **Deploy tip ID** | **BLOCKED** — not deployed this session |
| **Block reason** | `wrangler` OAuth is `adaptusclient@gmail.com` → account `c2cd6b6b…`. API calls to production account `9269f304…` fail with Authentication error `[code: 10000]`. No `CLOUDFLARE_API_TOKEN` in session env. |
| **Last known live tip** | Wave C: `ac488c82-adbb-4a44-88e9-e1611293809a` (see `WAVE_C_CF_DEPLOY_SIGNOFF.md`) — **does not include M0 fixes** |
| **Marketing deploy** | **SKIPPED** — no A/C marketing copy changes in this wave |

### Operator unblock (deploy)

```powershell
cd Adaptus-DMS/Adaptus-DMS
$env:CLOUDFLARE_API_TOKEN = "<token with Workers edit on 9269f304…>"
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
npm run deploy:cf
# or: npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```

Do **not** deploy under Adaptus OAuth alone — zone `flashfender.com` will not attach.

---

## Operator secrets

| Secret | Status |
|--------|--------|
| `RESEND_API_KEY` / `EMAIL_FROM` | **BLOCKED** — not inventable; live list requires prod account auth (see `SECRETS_OPS_STATUS.md`) |
| Meta (`FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`) | **BLOCKED** — same |
| Fake sends | **Not performed** |

---

## Smoke notes (code-level; live deploy pending)

### Reports (`GET /api/reports`)

1. Auth as Nova user → `type=summary` / `sales` / `inventory` / `financial` / `leads` / `expenses` must only reflect `dealership_id=dd404bb6-3e64-43ae-9eb7-98095033c6cb` (floors: vehicles≥158, deals≥77, invoices≥71 as sanity — not invent).
2. Platform admin without dealership filter may see cross-tenant aggregates (intentional, same as invoices/expenses APIs).
3. Expenses: `?type=expenses&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` must shrink `expenseCount` / totals vs unscoped month when dates exclude rows.
4. Unauthenticated → 401; user without dealership and not platform admin → 403.

### Invoice create (`POST /api/invoices`)

1. Body with `tax_rate` (e.g. `15`) and `package_name` (e.g. `"Service Package"`) → response `data.tax_rate` / `data.package_name` match; `tax_amount` / `total` consistent with rate.
2. Optional `line_items` array → persisted when column present (same as PUT path).
3. Omitting `tax_rate` still defaults to `13` (prior behavior).

**Live smoke:** blocked until M0 build is on `flashfender-dms` tip under account `9269f304…`.

---

## Verdict

**CODE PASS / DEPLOY BLOCKED / SECRETS BLOCKED**

M0 integrity fixes are in the app tree and typecheck clean. Production CF deploy and Resend/Meta secrets remain operator-gated on the correct Cloudflare account.
