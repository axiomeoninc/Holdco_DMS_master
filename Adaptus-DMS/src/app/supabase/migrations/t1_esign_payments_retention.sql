-- Tier 1: e-signatures, built-in payments, retention/compliance
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS only.
-- Applied via Supabase Management API database/query endpoint (see existing migrations).

-- ============================================================================
-- E-SIGNATURES
-- ============================================================================

-- Immutable electronic-signature record (typed name + initials + consent stamp).
-- Honest electronic signature: a consent timestamp + typed name/initials + audit
-- trace. NOT a biometric "wet signature" claim.
CREATE TABLE IF NOT EXISTS public.esign_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('bill_of_sale', 'quotation', 'we_owe', 'invoice')),
    document_id UUID,
    signer_name TEXT NOT NULL,
    signer_initials TEXT NOT NULL,
    signer_role TEXT NOT NULL DEFAULT 'buyer' CHECK (signer_role IN ('buyer', 'seller', 'manager')),
    consent_text TEXT,
    consent_timestamp TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- One signature per signer role per document (re-signing replaces).
    UNIQUE (document_type, document_id, signer_role)
);

CREATE INDEX IF NOT EXISTS idx_esign_signatures_dealership ON public.esign_signatures(dealership_id);
CREATE INDEX IF NOT EXISTS idx_esign_signatures_document ON public.esign_signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_esign_signatures_created ON public.esign_signatures(created_at DESC);

-- Signature state on documents (surfaced in UI / PDFs).
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS signed_by_name TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS signed_by_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS signed_by_name TEXT;

ALTER TABLE public.esign_signatures ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'esign_signatures_select_policy' AND polrelid = 'public.esign_signatures'::regclass) THEN
        CREATE POLICY esign_signatures_select_policy ON public.esign_signatures
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'esign_signatures_insert_policy' AND polrelid = 'public.esign_signatures'::regclass) THEN
        CREATE POLICY esign_signatures_insert_policy ON public.esign_signatures
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'esign_signatures_update_policy' AND polrelid = 'public.esign_signatures'::regclass) THEN
        CREATE POLICY esign_signatures_update_policy ON public.esign_signatures
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'esign_signatures_delete_policy' AND polrelid = 'public.esign_signatures'::regclass) THEN
        CREATE POLICY esign_signatures_delete_policy ON public.esign_signatures
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- BUILT-IN PAYMENTS (provider-agnostic ledger of payment intents/results)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe', 'manual', 'cash', 'cheque', 'etransfer')),
    provider_checkout_id TEXT,
    provider_payment_id TEXT,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CAD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requires_action', 'succeeded', 'failed', 'refunded', 'cancelled')),
    reference_type TEXT NOT NULL DEFAULT 'invoice' CHECK (reference_type IN ('invoice', 'deal', 'deposit', 'bill_of_sale')),
    reference_id UUID,
    description TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_dealership ON public.payment_records(dealership_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_reference ON public.payment_records(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_provider ON public.payment_records(provider, provider_checkout_id);

-- Payment status on deals (deposit capture) and BOS deposit capture.
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS deposit_paid NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid';

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'payment_records_select_policy' AND polrelid = 'public.payment_records'::regclass) THEN
        CREATE POLICY payment_records_select_policy ON public.payment_records
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'payment_records_insert_policy' AND polrelid = 'public.payment_records'::regclass) THEN
        CREATE POLICY payment_records_insert_policy ON public.payment_records
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'payment_records_update_policy' AND polrelid = 'public.payment_records'::regclass) THEN
        CREATE POLICY payment_records_update_policy ON public.payment_records
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'payment_records_delete_policy' AND polrelid = 'public.payment_records'::regclass) THEN
        CREATE POLICY payment_records_delete_policy ON public.payment_records
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- RETENTION / COMPLIANCE
-- ============================================================================

-- Archived full-dealership export records (10-year retention export trail).
CREATE TABLE IF NOT EXISTS public.retention_exports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    archive_type TEXT NOT NULL DEFAULT 'full' CHECK (archive_type IN ('full', 'documents', 'accounting')),
    status TEXT NOT NULL DEFAULT 'completed',
    file_name TEXT,
    file_size_bytes BIGINT,
    row_counts JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_exports_dealership ON public.retention_exports(dealership_id);
CREATE INDEX IF NOT EXISTS idx_retention_exports_created ON public.retention_exports(created_at DESC);

ALTER TABLE public.retention_exports ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'retention_exports_select_policy' AND polrelid = 'public.retention_exports'::regclass) THEN
        CREATE POLICY retention_exports_select_policy ON public.retention_exports
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'retention_exports_insert_policy' AND polrelid = 'public.retention_exports'::regclass) THEN
        CREATE POLICY retention_exports_insert_policy ON public.retention_exports
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- DEALERSHIP-SCOPED AUDIT LOG READ
-- ============================================================================
-- audit_logs already has dealership_id and a platform-admin-only policy.
-- Dealers must be able to read their OWN dealership's immutable trail while
-- platform admins keep full visibility.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_dealership_read_policy' AND polrelid = 'public.audit_logs'::regclass) THEN
        CREATE POLICY audit_logs_dealership_read_policy ON public.audit_logs
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_dealership_insert_policy' AND polrelid = 'public.audit_logs'::regclass) THEN
        CREATE POLICY audit_logs_dealership_insert_policy ON public.audit_logs
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
