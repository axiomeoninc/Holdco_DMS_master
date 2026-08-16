-- Tenant RLS hardening (repo-only; do not apply to live/production from this pass).
-- Idempotent: ENABLE RLS, DROP open policies, ADD tenant policies / privilege trigger.
-- Matches existing migration style (IF NOT EXISTS / DROP IF EXISTS / NOTIFY pgrst).
--
-- Fixes:
--   1. dealerships / roles / subscriptions / billing_information / user_roles
--      had policies in schema.sql but never ENABLE ROW LEVEL SECURITY (inert).
--   2. ocr_documents, vin_lookup_history, carfax_reports, finance_calculations
--      used FOR ALL USING (true) (any PostgREST role, including anon).
--   3. users INSERT/UPDATE allowed dealer peers to set is_platform_admin.

-- ============================================================================
-- DEALERSHIPS: tenant-read BEFORE enable (otherwise dealers cannot read self)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'dealerships_tenant_select_policy'
          AND polrelid = 'public.dealerships'::regclass
    ) THEN
        CREATE POLICY dealerships_tenant_select_policy ON public.dealerships
            FOR SELECT USING (
                id = get_user_dealership_id() OR is_platform_admin() = true
            );
    END IF;
END $$;

ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- user_roles has no dealership_id; scope via the mapped user's dealership.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'user_roles_select_policy'
          AND polrelid = 'public.user_roles'::regclass
    ) THEN
        CREATE POLICY user_roles_select_policy ON public.user_roles
            FOR SELECT USING (
                is_platform_admin() = true
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = user_roles.user_id
                      AND u.dealership_id = get_user_dealership_id()
                )
            );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'user_roles_insert_policy'
          AND polrelid = 'public.user_roles'::regclass
    ) THEN
        CREATE POLICY user_roles_insert_policy ON public.user_roles
            FOR INSERT WITH CHECK (
                is_platform_admin() = true
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = user_roles.user_id
                      AND u.dealership_id = get_user_dealership_id()
                )
            );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'user_roles_delete_policy'
          AND polrelid = 'public.user_roles'::regclass
    ) THEN
        CREATE POLICY user_roles_delete_policy ON public.user_roles
            FOR DELETE USING (
                is_platform_admin() = true
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = user_roles.user_id
                      AND u.dealership_id = get_user_dealership_id()
                )
            );
    END IF;
END $$;

-- ============================================================================
-- VIN cache: add dealership_id so it can be tenant-scoped
-- ============================================================================

ALTER TABLE public.vin_lookup_history
    ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vin_lookup_history_dealership
    ON public.vin_lookup_history(dealership_id);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_dealership
    ON public.ocr_documents(dealership_id);
CREATE INDEX IF NOT EXISTS idx_carfax_reports_dealership
    ON public.carfax_reports(dealership_id);
CREATE INDEX IF NOT EXISTS idx_finance_calculations_dealership
    ON public.finance_calculations(dealership_id);

-- ============================================================================
-- Replace USING (true) catch-alls with dealership policies
-- ============================================================================

DROP POLICY IF EXISTS ocr_documents_all_policy ON public.ocr_documents;
DROP POLICY IF EXISTS vin_lookup_history_all_policy ON public.vin_lookup_history;
DROP POLICY IF EXISTS carfax_reports_all_policy ON public.carfax_reports;
DROP POLICY IF EXISTS finance_calculations_all_policy ON public.finance_calculations;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'ocr_documents_select_policy'
          AND polrelid = 'public.ocr_documents'::regclass
    ) THEN
        CREATE POLICY ocr_documents_select_policy ON public.ocr_documents
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'ocr_documents_insert_policy'
          AND polrelid = 'public.ocr_documents'::regclass
    ) THEN
        CREATE POLICY ocr_documents_insert_policy ON public.ocr_documents
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'ocr_documents_update_policy'
          AND polrelid = 'public.ocr_documents'::regclass
    ) THEN
        CREATE POLICY ocr_documents_update_policy ON public.ocr_documents
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'ocr_documents_delete_policy'
          AND polrelid = 'public.ocr_documents'::regclass
    ) THEN
        CREATE POLICY ocr_documents_delete_policy ON public.ocr_documents
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'vin_lookup_history_select_policy'
          AND polrelid = 'public.vin_lookup_history'::regclass
    ) THEN
        CREATE POLICY vin_lookup_history_select_policy ON public.vin_lookup_history
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'vin_lookup_history_insert_policy'
          AND polrelid = 'public.vin_lookup_history'::regclass
    ) THEN
        CREATE POLICY vin_lookup_history_insert_policy ON public.vin_lookup_history
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'vin_lookup_history_update_policy'
          AND polrelid = 'public.vin_lookup_history'::regclass
    ) THEN
        CREATE POLICY vin_lookup_history_update_policy ON public.vin_lookup_history
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'vin_lookup_history_delete_policy'
          AND polrelid = 'public.vin_lookup_history'::regclass
    ) THEN
        CREATE POLICY vin_lookup_history_delete_policy ON public.vin_lookup_history
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'carfax_reports_select_policy'
          AND polrelid = 'public.carfax_reports'::regclass
    ) THEN
        CREATE POLICY carfax_reports_select_policy ON public.carfax_reports
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'carfax_reports_insert_policy'
          AND polrelid = 'public.carfax_reports'::regclass
    ) THEN
        CREATE POLICY carfax_reports_insert_policy ON public.carfax_reports
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'carfax_reports_update_policy'
          AND polrelid = 'public.carfax_reports'::regclass
    ) THEN
        CREATE POLICY carfax_reports_update_policy ON public.carfax_reports
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'carfax_reports_delete_policy'
          AND polrelid = 'public.carfax_reports'::regclass
    ) THEN
        CREATE POLICY carfax_reports_delete_policy ON public.carfax_reports
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'finance_calculations_select_policy'
          AND polrelid = 'public.finance_calculations'::regclass
    ) THEN
        CREATE POLICY finance_calculations_select_policy ON public.finance_calculations
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'finance_calculations_insert_policy'
          AND polrelid = 'public.finance_calculations'::regclass
    ) THEN
        CREATE POLICY finance_calculations_insert_policy ON public.finance_calculations
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'finance_calculations_update_policy'
          AND polrelid = 'public.finance_calculations'::regclass
    ) THEN
        CREATE POLICY finance_calculations_update_policy ON public.finance_calculations
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'finance_calculations_delete_policy'
          AND polrelid = 'public.finance_calculations'::regclass
    ) THEN
        CREATE POLICY finance_calculations_delete_policy ON public.finance_calculations
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- Privilege escalation: dealer peers cannot flip is_platform_admin / dealership
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_user_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Service-role / migrations have no JWT; RLS is already bypassed there.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.is_platform_admin = true AND COALESCE(is_platform_admin(), false) = false THEN
            RAISE EXCEPTION 'Unauthorized: cannot set is_platform_admin';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
       AND COALESCE(is_platform_admin(), false) = false THEN
        RAISE EXCEPTION 'Unauthorized: cannot change is_platform_admin';
    END IF;

    IF NEW.dealership_id IS DISTINCT FROM OLD.dealership_id
       AND COALESCE(is_platform_admin(), false) = false THEN
        RAISE EXCEPTION 'Unauthorized: cannot change dealership_id';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_user_privilege_escalation ON public.users;
CREATE TRIGGER prevent_user_privilege_escalation
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_user_privilege_escalation();

NOTIFY pgrst, 'reload schema';
