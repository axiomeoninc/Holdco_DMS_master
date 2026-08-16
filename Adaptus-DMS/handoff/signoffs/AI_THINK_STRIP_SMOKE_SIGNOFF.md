# AI think-strip smoke signoff

**Date:** 2026-08-04  
**Scope:** Flash AI thinking-tag strip, JSON harden, Flash AI branding only, deep `/api/ai/*` smoke  
**Do not edit the plan file.**

## Tip IDs

| Worker | Version ID |
|--------|------------|
| **flashfender-dms** | `2192b7ec-96f5-4c24-bc3d-1541c149edb0` |
| **flashfender-web** | `18f9cefd-a37c-44bc-8c05-00e1ead80c17` |

**CF account:** `9269f304c042e14181e08bf8ee7aa4f9`  
**App:** https://app.flashfender.com  
**Site:** https://flashfender.com  
**Git:** `production` @ `9771144619e63362554dea767e919e85b2900403` (origin ManishKumar untouched)  

## Floors

| Metric | Count | Floor | Pass |
|--------|------:|------:|:----:|
| Vehicles | 158 | ≥158 | ✅ |
| Deals | 78 | ≥78 | ✅ |
| Invoices | 72 | ≥72 | ✅ |

## What shipped

1. **LLM client** — `src/lib/ai/llm.ts` (+ `sanitize.ts`): `reasoning_split: true`, `stripThinkingArtifacts`, `extractJsonObject`, stream sanitizer (buffers open think spans). Former `minimax.ts` removed from app surface.
2. **Routes** — follow-up / inventory-search use `extractJsonObject`; all AI routes strip thinking; prompts forbid think tags; empty drafts → 502.
3. **Client** — `AiActionButton` + `FlashAiPanel` strip/format drafts; labels Flash AI only.
4. **Branding** — Status API `provider: "flash_ai"`, model label `flash-ai`; Integrations “Flash AI · configured”; amber banner without secret names; marketing AI Desk pages scrubbed.
5. **tsc** — `npx tsc --noEmit` exit 0 before deploy.

## Pass matrix (Nova auth smoke)

Probe: `migration/_sync_audit/_ai_think_strip_smoke.py` → **17/17 PASS** (`all_pass=true`).

| Check | Status | Pass |
|-------|-------:|:----:|
| login | 200 | ✅ |
| floor_vehicles | 200 / 158 | ✅ |
| floor_deals | 200 / 78 | ✅ |
| floor_invoices | 200 / 72 | ✅ |
| GET /api/ai/status | 200 · `provider=flash_ai` · no vendor string | ✅ |
| GET /api/settings/integrations | 200 · no vendor string | ✅ |
| POST /api/ai/follow-up | 200 · clean body · no `<think` | ✅ |
| POST /api/ai/description | 200 · no `<think` | ✅ |
| POST /api/ai/price-narrative | 200 · no `<think` | ✅ |
| POST /api/ai/disclosure | 200 · no `<think` | ✅ |
| POST /api/ai/inventory-search | 200 · filters JSON | ✅ |
| POST /api/ai/quote-coach | 200 · no `<think` | ✅ |
| GET /api/ai/desk-brief | 200 · no `<think` | ✅ |
| POST /api/ai/copilot (stream) | 200 · text/plain · no `<think` | ✅ |
| UI /dashboard | 200 · Ask Flash AI · no vendor | ✅ |
| UI /inventory | 200 · no vendor | ✅ |
| UI /quotations | 200 · no vendor | ✅ |
| UI /settings/integrations | 200 · no vendor | ✅ |

## User-facing summary

Flash AI drafts and Desk Copilot no longer leak model thinking markup into follow-ups, listings, disclosures, or chat. Status and Integrations identify **Flash AI** only. Product replies stay review-before-send drafts.

## Notes (operators)

- Worker env secret for the model API stays server-only (never shown in UI).
- Smoke may one-retry AI POSTs on transient 5xx (upstream blip).
- No secrets in this file.

## Non-goals

New AI features beyond reliability/branding; naming upstream model hosts in UI.
