-- Wave M1: lead score persistence + deal commission columns
-- Safe additive: IF NOT EXISTS only. No Hillz / seed data.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score INTEGER;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperature TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS converted_deal_id UUID REFERENCES public.sales_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(temperature);

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2);

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS warranty_package TEXT;

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS gap_coverage BOOLEAN DEFAULT false;

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS tire_coverage BOOLEAN DEFAULT false;

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS paint_protection BOOLEAN DEFAULT false;

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS extended_service BOOLEAN DEFAULT false;

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS financing_notes TEXT;

COMMENT ON COLUMN public.leads.score IS 'Persisted Hot/Warm/Cold score 0-100 from scoreLead()';
COMMENT ON COLUMN public.leads.temperature IS 'Hot | Warm | Cold band for filters';
