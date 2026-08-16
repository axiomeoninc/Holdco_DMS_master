-- Tier 3: Service module
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS only.
-- Applied via Supabase Management API database/query endpoint (see existing migrations).
-- Honest: service reactivation candidates are INFORMATIONAL and consent-gated in the app;
-- this schema only stores service history and optional consent to be contacted about service.

-- ============================================================================
-- SERVICE RECORDS (customer + vehicle service history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    service_date DATE NOT NULL,
    odometer INTEGER,
    service_type TEXT NOT NULL CHECK (service_type IN (
        'oil_change', 'maintenance', 'repair', 'tire', 'brake', 'inspection',
        'recall', 'detail', 'warranty', 'other'
    )),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'in_progress', 'scheduled', 'cancelled')),
    notes TEXT,
    cost NUMERIC(12,2),
    performed_by TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_records_dealership ON public.service_records(dealership_id);
CREATE INDEX IF NOT EXISTS idx_service_records_customer ON public.service_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_vehicle ON public.service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_records_date ON public.service_records(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_service_records_location ON public.service_records(location_id) WHERE location_id IS NOT NULL;

-- Optional per-customer service marketing consent (CASL-aligned; informational
-- reactivation only surfaces when consent is true).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS service_contact_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS service_contact_consent_at TIMESTAMPTZ;

ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'service_records_select_policy' AND polrelid = 'public.service_records'::regclass) THEN
        CREATE POLICY service_records_select_policy ON public.service_records
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'service_records_insert_policy' AND polrelid = 'public.service_records'::regclass) THEN
        CREATE POLICY service_records_insert_policy ON public.service_records
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'service_records_update_policy' AND polrelid = 'public.service_records'::regclass) THEN
        CREATE POLICY service_records_update_policy ON public.service_records
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'service_records_delete_policy' AND polrelid = 'public.service_records'::regclass) THEN
        CREATE POLICY service_records_delete_policy ON public.service_records
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
