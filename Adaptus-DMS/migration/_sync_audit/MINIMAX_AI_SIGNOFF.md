# MiniMax AI signoff

**Date:** 2026-08-04  
**Scope:** `minimax-ai` only (no CF full deploy / smoke-deploy wave)  
**Worker:** `flashfender-dms` · Account `9269f304c042e14181e08bf8ee7aa4f9`

## Security

1. **`MINIMAX_API_KEY`** set via `wrangler secret put` on production worker (confirmed in `secret list` alongside `SUPABASE_SERVICE_ROLE_KEY`).
2. Key never committed; local `.env.local` is gitignored (dev only).
3. **Rotate the MiniMax key** in the MiniMax dashboard — it was pasted in chat earlier (`sk-cp-…`). Treat the prior paste as compromised.
4. Server-only: browser never receives the key. Missing key → amber “Not configured” / HTTP 503 — no fake success.

## Backend

| Path | Role |
|------|------|
| `src/lib/ai/minimax.ts` | OpenAI-compatible client → `https://api.minimax.io/v1`, model `MiniMax-M2.7` |
| `src/lib/ai/tools.ts` | Dealership-scoped tools: `search_vehicles`, `get_lead`, `summarize_deal`, `list_aging_units` (no floors/cost) |
| `src/lib/ai/guard.ts` | Auth + honesty helpers |
| `GET /api/ai/status` | Configured flag |
| `POST /api/ai/copilot` | Streaming Desk Copilot + tool loop |
| `POST /api/ai/description` | Listing description draft |
| `POST /api/ai/follow-up` | CASL-aware follow-up draft (`sent: false`) |
| `POST /api/ai/price-narrative` | Price/aging narrative (floors null) |
| `POST /api/ai/inventory-search` | NL → filter params |
| `POST /api/ai/disclosure` | Ontario MVDA helper (human confirm) |
| `POST /api/ai/quote-coach` | Quote objection coach |
| `GET /api/ai/desk-brief` | Daily desk brief |
| Integrations | `minimax` row + `MINIMAX_API_KEY` boolean in secrets_present |

## UI

- cmdk **Ask Flash AI** + TopHeader button → Vaul `FlashAiPanel`
- Dashboard **Daily desk brief** widget
- Intake TipTap description **Generate with Flash AI** (sibling TipTap)
- VDP: generate description, price/aging narrative, disclosure helper
- Inventory NL Flash AI filters
- Lead details follow-up draft (textarea; not Sent)
- Quotations objection coach

## Floors

AI tools/prompts omit purchase/floor prices. Narratives use retail/special only. Floors 158/78/72 untouched.

## Deferred

- Full CF redeploy / dual deploy → `smoke-deploy` todo  
- Production AI live until next worker deploy picks up code (secret already on worker)

## Stack

Next.js + Supabase + Cloudflare OpenNext — unchanged.
