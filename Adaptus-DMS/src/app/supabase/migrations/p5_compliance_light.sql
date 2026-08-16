-- P5 compliance light: CASL consent + MVDA known damage
-- Applied via Supabase Management API (2026-08-02). Idempotent.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS known_damage BOOLEAN NOT NULL DEFAULT false;
