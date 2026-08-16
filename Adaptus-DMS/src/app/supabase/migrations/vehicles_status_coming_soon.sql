-- Intake drafts use status 'Coming Soon'; inventory bulk edit also allows
-- 'Inactive'. The original CHECK only permitted Active/Sold/Pending/Traded,
-- so POST /api/vehicles from Add New Car returned 500 (constraint 23514).
-- Applied live 2026-08-15. Idempotent.

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (status = ANY (ARRAY[
    'Active'::text,
    'Sold'::text,
    'Pending'::text,
    'Traded'::text,
    'Coming Soon'::text,
    'Inactive'::text
  ]));
