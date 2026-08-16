# Wave M3 — Money Slice Signoff (Finance)

**Stamp:** 2026-08-04  
**Scope:** Master Guide Wave M3 finance slice only — invoice PDF + email + AR payment ledger; salesperson / commissions light report.  
**Out of this signoff:** CASL unsubscribe write, real notifications, billing/Stripe (platform siblings).  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Plan:** `master_guide_micro_gaps_ef669d4b.plan.md`  
**Floors:** Do not invent Hillz / production rows.

---

## Delivered

| Item | Status | Notes |
|------|--------|-------|
| Invoice print PDF | **Present** | Browser print HTML (`src/lib/invoice-pdf.ts`) — same CF-safe pattern as BOS |
| Invoice email send | **Present** | `POST /api/invoices/[id]/send` via Resend; 503 when secrets missing |
| AR payment ledger | **Present** | `GET/POST /api/invoices/[id]/payments` → `financial_transactions` (`Payment` / `reference_type=invoice`); updates `amount_paid` + status |
| Invoice details UI | **Present** | PDF / Email / Record payment in `InvoiceDetailsModal` |
| Salesperson performance | **Present** | Reports tab **Commissions** → `type=salesperson`; sales tab shows top salespeople |
| Commissions light | **Present** | Uses deal `commission_amount` / `commission_rate`; else estimates 25% of front-end gross |

---

## Bugs found / fixed (this pass)

1. M3 features were **Missing** in live routes/UI — implemented light ledger + PDF/email + report type (not a rewrite of invoice CRUD).
2. Sales report returned `topSalespeople` but UI never rendered them — wired.
3. No dedicated commissions report type — added `salesperson` / `commissions` aliases.

---

## Verification

- Static review of new payment/send routes + PDF helper + reports UI
- `npx tsc --noEmit` — finance files clean
- Email send requires `RESEND_API_KEY` + `EMAIL_FROM` (see Settings → Integrations / `SECRETS_OPS_STATUS.md`)
- Live payment write needs `amount_paid` column on `invoices` (schema ALTER documented in M0)

---

## Remaining risks

- **Resend not configured** → email returns 503 (honest; no fake success).
- **Commission estimate** is a light default when deals lack `commission_*` — dealers should set rates on deals for accuracy.
- Full GL / `financial_transactions` browsing UI still deferred.
- CF deploy pending.
- Platform M3 items (CASL, notifications, billing) **not** claimed here.

---

## Files touched (M3 finance)

- `src/lib/invoice-pdf.ts` (sibling seed + used)
- `src/app/api/invoices/[id]/send/route.ts`
- `src/app/api/invoices/[id]/payments/route.ts`
- `src/components/InvoiceDetailsModal.tsx`
- `src/app/(dashboard)/invoices/page.tsx`
- `src/app/api/reports/route.ts` (`salesperson` / commissions)
- `src/app/(dashboard)/reports/page.tsx`
- `migration/_sync_audit/WAVE_M3_MONEY_FINANCE_SIGNOFF.md` (this file)

**Verdict:** Wave M3 **finance money slice shipped locally** (PDF + AR + salesperson light). Platform M3 items remain separate.
