-- Wave M3 — Money & compliance (idempotent)
-- Invoice AR fields, CASL consent IP / unsubscribe stamp.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS package_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 13;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_consent_ip TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sms_consent_ip TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT;
