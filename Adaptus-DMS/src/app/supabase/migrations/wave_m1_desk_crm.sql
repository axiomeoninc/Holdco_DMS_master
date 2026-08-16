-- Wave M1 — Desk & CRM (QA companion to wave_m1_desk_pipeline.sql)
-- Safe / idempotent. Prefer applying wave_m1_desk_pipeline.sql first.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS temperature TEXT;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS converted_deal_id UUID REFERENCES public.sales_deals(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_temperature_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_temperature_check
      CHECK (temperature IS NULL OR temperature IN ('Hot', 'Warm', 'Cold'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(dealership_id, score);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(dealership_id, temperature);

ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2);
