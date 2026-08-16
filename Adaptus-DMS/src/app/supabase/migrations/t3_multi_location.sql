-- Tier 3: Multi-location (tenant-rooftop) support
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS only.
-- Applied via Supabase Management API database/query endpoint (see existing migrations).
-- Strictly backward-compatible: location_id is nullable (NULL = legacy single-location).

-- ============================================================================
-- LOCATIONS (rooftops)
-- ============================================================================

-- A dealership may operate multiple rooftops/locations. Vehicle inventory,
-- deals, and leads can be scoped to one location. Existing rows keep
-- location_id NULL, which behaves exactly like the pre-feature state.
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    hours TEXT,
    settings JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_dealership ON public.locations(dealership_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON public.locations(dealership_id, is_active);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'locations_select_policy' AND polrelid = 'public.locations'::regclass) THEN
        CREATE POLICY locations_select_policy ON public.locations
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'locations_insert_policy' AND polrelid = 'public.locations'::regclass) THEN
        CREATE POLICY locations_insert_policy ON public.locations
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'locations_update_policy' AND polrelid = 'public.locations'::regclass) THEN
        CREATE POLICY locations_update_policy ON public.locations
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'locations_delete_policy' AND polrelid = 'public.locations'::regclass) THEN
        CREATE POLICY locations_delete_policy ON public.locations
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- LOCATION SCOPING ON CORE RECORDS (nullable = legacy single-location)
-- ============================================================================

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_from_public ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_location ON public.vehicles(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_deals_location ON public.sales_deals(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_location ON public.leads(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_location ON public.customers(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_location ON public.purchase_from_public(location_id) WHERE location_id IS NOT NULL;

-- Showroom scope: when a dealership runs the hosted showroom, it can opt to
-- expose a single location's inventory (settings.showroom_location_id).
-- (Column is advisory — the app reads it from dealerships.settings.)

NOTIFY pgrst, 'reload schema';
