-- Tier 2: explainable lead scoring, after-hours AI first response,
-- AI governance console, and credit application capture.
-- Idempotent, follows the repo's existing migration pattern (RLS via
-- get_user_dealership_id(), updated_at via update_updated_at_column()).
-- Apply via the repo's migration tooling — do NOT run manually in dev.

-- ---------------------------------------------------------------------------
-- leads: persist the AI "why this lead" explanation next to the score
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_why TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_why_at TIMESTAMPTZ;

-- Append-only history of generated explanations (audit trail for governance).
CREATE TABLE IF NOT EXISTS public.lead_score_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'flash-ai',
    generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_explanations_lead
    ON public.lead_score_explanations(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_explanations_dealership
    ON public.lead_score_explanations(dealership_id);

-- ---------------------------------------------------------------------------
-- AI governance configuration (one row per dealership)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_governance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL UNIQUE REFERENCES public.dealerships(id) ON DELETE CASCADE,
    -- Claims guardrails (FTC: "AI claims are dealer claims")
    claims_guardrail_enabled BOOLEAN NOT NULL DEFAULT true,
    blocked_claims TEXT[] NOT NULL DEFAULT '{}',
    allowed_claims TEXT[] NOT NULL DEFAULT '{}',
    -- Quiet-hours enforcement for after-hours AI first response
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start TEXT NOT NULL DEFAULT '20:00',
    quiet_hours_end TEXT NOT NULL DEFAULT '09:00',
    quiet_hours_timezone TEXT NOT NULL DEFAULT 'America/Toronto',
    -- After-hours auto-send gate (draft-first until an operator enables it)
    auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
    escalation_on_pricing BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- After-hours AI first-response log (never claims a send that did not happen)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_desk_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'blocked', 'failed', 'escalated')),
    subject TEXT,
    body TEXT NOT NULL,
    bot_disclosure BOOLEAN NOT NULL DEFAULT true,
    consent_ok BOOLEAN NOT NULL DEFAULT false,
    escalated_to_human BOOLEAN NOT NULL DEFAULT false,
    escalate_reason TEXT,
    block_reason TEXT,
    send_provider_id TEXT,
    error TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_desk_replies_lead ON public.ai_desk_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_desk_replies_dealership
    ON public.ai_desk_replies(dealership_id, created_at);

-- ---------------------------------------------------------------------------
-- AI correction log (record of human corrections/overrides of AI output)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'draft' CHECK (kind IN ('claims', 'draft', 'reply', 'score', 'other')),
    original_text TEXT,
    corrected_text TEXT,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    corrected_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_corrections_dealership
    ON public.ai_corrections(dealership_id, corrected_at);

-- ---------------------------------------------------------------------------
-- Credit applications (capture + partner-led screening; NOT a lender network)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'screening_ready'
        CHECK (status IN ('draft', 'screening_ready', 'submitted', 'decision_received', 'cancelled')),
    -- Applicant
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    -- Employment / income
    employer TEXT,
    employment_years NUMERIC(4,1),
    annual_income NUMERIC(12,2),
    monthly_rent NUMERIC(12,2),
    -- Desired purchase
    desired_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    requested_amount NUMERIC(12,2),
    trade_in_value NUMERIC(12,2),
    trade_in_payoff NUMERIC(12,2),
    -- Co-applicant (optional)
    coapplicant_first_name TEXT,
    coapplicant_last_name TEXT,
    coapplicant_annual_income NUMERIC(12,2),
    coapplicant_employer TEXT,
    -- OCR prefill provenance
    ocr_confidence NUMERIC(5,2),
    -- Partner screening (stub — only set when a partner channel is configured)
    partner_channel_configured BOOLEAN NOT NULL DEFAULT false,
    partner_submitted_at TIMESTAMPTZ,
    partner_reference TEXT,
    screening_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_applications_dealership
    ON public.credit_applications(dealership_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_applications_customer
    ON public.credit_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_applications_status
    ON public.credit_applications(dealership_id, status);

-- Partner channels (per dealership; "configured" is operator-set, honest amber)
CREATE TABLE IF NOT EXISTS public.credit_partner_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL DEFAULT 'screening',
    configured BOOLEAN NOT NULL DEFAULT false,
    reference_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (dealership_id, name)
);

-- ---------------------------------------------------------------------------
-- RLS + policies (mirror existing per-dealership policy pattern)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'lead_score_explanations',
        'ai_governance_config',
        'ai_desk_replies',
        'ai_corrections',
        'credit_applications',
        'credit_partner_channels'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = t || '_select_policy'
              AND polrelid = format('public.%I', t)::regclass
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT USING (dealership_id = get_user_dealership_id());',
                t || '_select_policy', t
            );
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = t || '_insert_policy'
              AND polrelid = format('public.%I', t)::regclass
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());',
                t || '_insert_policy', t
            );
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = t || '_update_policy'
              AND polrelid = format('public.%I', t)::regclass
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR UPDATE USING (dealership_id = get_user_dealership_id());',
                t || '_update_policy', t
            );
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = t || '_delete_policy'
              AND polrelid = format('public.%I', t)::regclass
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR DELETE USING (dealership_id = get_user_dealership_id());',
                t || '_delete_policy', t
            );
        END IF;
    END LOOP;
END $$;

-- updated_at triggers
DROP TRIGGER IF EXISTS update_ai_governance_config_updated_at ON public.ai_governance_config;
CREATE TRIGGER update_ai_governance_config_updated_at
    BEFORE UPDATE ON public.ai_governance_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_desk_replies_updated_at ON public.ai_desk_replies;
CREATE TRIGGER update_ai_desk_replies_updated_at
    BEFORE UPDATE ON public.ai_desk_replies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_applications_updated_at ON public.credit_applications;
CREATE TRIGGER update_credit_applications_updated_at
    BEFORE UPDATE ON public.credit_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_partner_channels_updated_at ON public.credit_partner_channels;
CREATE TRIGGER update_credit_partner_channels_updated_at
    BEFORE UPDATE ON public.credit_partner_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
