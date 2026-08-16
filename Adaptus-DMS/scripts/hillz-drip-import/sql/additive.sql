-- Additive Hillz DRIP import schema. Idempotent. Do not drop or wipe existing rooftops.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS driver_license_number TEXT;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE TABLE IF NOT EXISTS public.hillz_import_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  hillz_id TEXT NOT NULL,
  dms_id UUID NOT NULL,
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
  extra JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kind, hillz_id)
);

CREATE INDEX IF NOT EXISTS idx_hillz_import_map_dealership
  ON public.hillz_import_map (dealership_id);

CREATE INDEX IF NOT EXISTS idx_hillz_import_map_dms_id
  ON public.hillz_import_map (dms_id);

COMMENT ON TABLE public.hillz_import_map IS
  'Replay map for DRIP Hillz import (kind + hillz_id -> DMS uuid).';
