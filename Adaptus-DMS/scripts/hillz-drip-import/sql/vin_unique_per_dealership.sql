-- VIN is unique per rooftop, not globally. Multiple dealerships may stock the same VIN.
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.vehicles'::regclass
      AND con.contype = 'u'
    GROUP BY con.conname
    HAVING COUNT(*) = 1 AND MAX(att.attname) = 'vin'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.vehicles_vin_key;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_dealership_id_vin_key
  ON public.vehicles (dealership_id, vin);

CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON public.vehicles (vin);
