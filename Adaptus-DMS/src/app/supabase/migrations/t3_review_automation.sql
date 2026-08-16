-- Tier 3: Review automation
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS only.
-- Applied via Supabase Management API database/query endpoint (see existing migrations).
-- Honest: no fake "sent" states. Auto-send only happens when the dealership has
-- configured Resend email AND review automation is enabled AND the customer has
-- given marketing consent. Everything else stays "draft" (amber).

-- ============================================================================
-- REVIEW REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.review_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.sales_deals(id) ON DELETE SET NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'clicked', 'reviewed', 'opted_out')),
    consent_ok BOOLEAN NOT NULL DEFAULT false,
    review_url TEXT,
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    last_error TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_dealership ON public.review_requests(dealership_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_customer ON public.review_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON public.review_requests(status);
CREATE INDEX IF NOT EXISTS idx_review_requests_token ON public.review_requests(token);

-- Review automation settings live on dealerships.settings.review_automation:
--   { enabled: boolean, auto_send: boolean, days_after_deal: number,
--     google_review_url: string|null, review_note: string|null }
-- Nothing below is a table column because the settings blob already exists.

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'review_requests_select_policy' AND polrelid = 'public.review_requests'::regclass) THEN
        CREATE POLICY review_requests_select_policy ON public.review_requests
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'review_requests_insert_policy' AND polrelid = 'public.review_requests'::regclass) THEN
        CREATE POLICY review_requests_insert_policy ON public.review_requests
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'review_requests_update_policy' AND polrelid = 'public.review_requests'::regclass) THEN
        CREATE POLICY review_requests_update_policy ON public.review_requests
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'review_requests_delete_policy' AND polrelid = 'public.review_requests'::regclass) THEN
        CREATE POLICY review_requests_delete_policy ON public.review_requests
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
