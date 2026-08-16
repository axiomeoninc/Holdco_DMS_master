# DEEPEST QA L16 — Ops cluster SIGNOFF

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 16 / 20 — Ops cluster  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com  
**Scope:** calendar · tasks · tickets · follow-ups · test-drives  
**CF deploy:** **skipped** (integrator owns redeploy)  
**Floors (live smoke):** vehicles **158** · deals **78** · invoices **72** (≥158/77/71)

---

## Verdict

**PASS (local fixes pending CF)** — Live read paths healthy; P0 test-drive assignee IDOR + create/edit field mismatch fixed in tree; calendar honesty + Admin/Manager list scoping + delete gates tightened. Redeploy required for live to pick up fixes.

---

## Live smoke (pre-fix tip)

| Surface | Result | Notes |
|---------|--------|-------|
| Unauth `/calendar` `/tasks` `/tickets` `/follow-ups` `/test-drives` | **PASS** | Final URL → `/login?next=…` |
| Auth pages (same) | **PASS** | 200 after QA Admin login |
| `GET /api/tasks?limit=5` | **PASS** | count **1** |
| `GET /api/tickets?limit=5` | **PASS** | count **1** |
| `GET /api/follow-ups?limit=5` | **PASS** | count **2** |
| `GET /api/test-drives?limit=5` | **PASS** | count **13** |
| `GET /api/{resource}/{id}` (admin) | **PASS** | all four return `data` |
| Filters (`status`, `overdue`) | **PASS** | 200; overdue counts 0 (data-correct) |
| Salesperson list scope | **PASS** | counts 0 when nothing assigned to SP |
| Salesperson `GET /api/test-drives/{other-assigned-id}` | **FAIL → fixed local** | Was **200** (IDOR); ownership now uses `user_id` |
| Floors | **PASS** | 158 / 78 / 72 |

Auth: `f02_test_adaptus@adaptusgroup.ca` (platform Admin) · `f02_qa_salesperson@adaptusgroup.ca` (Salesperson). Passwords not recorded here.

---

## Bugs found + fixed (local)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | **P0** | Test-drive `[id]` ownership checked `assigned_to`, but rows use `user_id` — salesperson could fetch/update/delete another assignee’s TD by UUID | Map `user_id` → `assigned_to` in all `assertOwnershipOrDeny` calls in `api/test-drives/[id]/route.ts` |
| 2 | **P0** | Test-drive form omitted `scheduled_date` (API required) and sent `salesperson_id` instead of `user_id` — create/edit would 400 / drop assignee | `TestDriveFormModal`: send `scheduled_date` from start time; map salesperson → `user_id`; load `user_id` on edit; DL fields appended to notes (no fake columns) |
| 3 | **Medium** | Calendar follow-ups used `row.subject` (tickets field) — titles fell back to generic “Follow-up” | Use `row.title`; subtitle from notes/description |
| 4 | **Medium** | Calendar “Appointment” filter always empty; tasks never loaded | Fetch `/api/tasks`; map due tasks as `appointment` (label **Task**); Tasks quick link |
| 5 | **Medium** | Tickets / follow-ups / test-drives list: Admin/Manager lacked role `viewAll` (unlike tasks); SP list excluded unassigned while detail allowed unassigned | Align `viewAll` + `.or(assigned/user_id.eq.self, *.is.null)` for scoped roles |
| 6 | **Medium** | Tickets / follow-ups `DELETE` had no delete permission gate | Require Admin/Manager/`*:delete`/`*` (same pattern as tasks) |
| 7 | **Low** | Follow-up reopen left `completed_at` set | Clear `completed_at` / `completed_by` when status → Pending/Cancelled |
| 8 | **Low** | Tasks `overdue=true` PostgREST `.eq().or()` filter malformed | `.in(status).lt(due_date)` |

---

## Files touched

- `src/app/api/test-drives/[id]/route.ts`
- `src/app/api/test-drives/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/tickets/route.ts`
- `src/app/api/tickets/[id]/route.ts`
- `src/app/api/follow-ups/route.ts`
- `src/app/api/follow-ups/[id]/route.ts`
- `src/components/TestDriveFormModal.tsx`
- `src/app/(dashboard)/calendar/page.tsx`

---

## Deferred

| Item | Reason |
|------|--------|
| CF redeploy of L16 fixes | Explicit **No CF deploy** for this lane |
| Driver-license columns on `test_drives` | Not in live schema; honesty via notes until migration exists |
| Destructive CRUD / delete of Nova Hillz rows | Floors protected — code-reviewed + read smoke only |
| Kanban drag visual E2E | HTTP + static; no agent-browser in this pass |

---

## Redeploy note (integrator)

```bash
cd Adaptus-DMS/Adaptus-DMS
# after tsc — integrator only:
npm run deploy:cf
```

Post-deploy: re-probe salesperson `GET /api/test-drives/{foreign-assigned-id}` → expect **403**; create test-drive with start time → expect **201** with `scheduled_date` + `user_id`.

---

## Signoff

**Lane 16 Ops cluster: PASS (local)** — live tip still lacks these patches until integrator CF deploy.
