-- Tier 1: SMS messaging + sequences, webhook deliveries, dealership event log
-- Idempotent. Applied via the repo's supabase migration tooling (schema.sql style).
-- Follows the phase2_crm_email_sequences.sql pattern (IF NOT EXISTS + RLS policies).

-- ---------------------------------------------------------------------------
-- sms_messages — real send log (never fabricated; status reflects provider truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    direction TEXT NOT NULL DEFAULT 'outbound'
        CHECK (direction IN ('outbound', 'inbound')),
    phone TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped', 'blocked', 'opt_out', 'received')),
    provider TEXT,
    provider_sid TEXT,
    error TEXT,
    consent_checked BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_blocked BOOLEAN NOT NULL DEFAULT false,
    provider_status TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_dealership
    ON public.sms_messages(dealership_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer
    ON public.sms_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created
    ON public.sms_messages(created_at DESC);

-- ---------------------------------------------------------------------------
-- sms_sequences (stage-triggered follow-up, mirrors email_sequences)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_sequences_dealership
    ON public.sms_sequences(dealership_id);

CREATE TABLE IF NOT EXISTS public.sms_sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES public.sms_sequences(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
    body_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_sms_sequence_steps_sequence
    ON public.sms_sequence_steps(sequence_id);

CREATE TABLE IF NOT EXISTS public.sms_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.sms_sequences(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'stopped', 'completed')),
    current_step INTEGER NOT NULL DEFAULT 0,
    enrolled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stopped_at TIMESTAMPTZ,
    stop_reason TEXT,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sms_sequence_enrollments_target_chk
        CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sms_sequence_enrollments_dealership
    ON public.sms_sequence_enrollments(dealership_id);
CREATE INDEX IF NOT EXISTS idx_sms_sequence_enrollments_sequence
    ON public.sms_sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sms_sequence_enrollments_lead
    ON public.sms_sequence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_sequence_enrollments_customer
    ON public.sms_sequence_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_sequence_enrollments_status
    ON public.sms_sequence_enrollments(dealership_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_seq_enroll_active_lead
    ON public.sms_sequence_enrollments(sequence_id, lead_id)
    WHERE status = 'active' AND lead_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_seq_enroll_active_customer
    ON public.sms_sequence_enrollments(sequence_id, customer_id)
    WHERE status = 'active' AND customer_id IS NOT NULL AND lead_id IS NULL;

CREATE TABLE IF NOT EXISTS public.sms_sequence_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.sms_sequence_enrollments(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES public.sms_sequence_steps(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    to_phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    sms_message_id UUID REFERENCES public.sms_messages(id) ON DELETE SET NULL,
    provider_sid TEXT,
    error TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_sequence_sends_enrollment
    ON public.sms_sequence_sends(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sms_sequence_sends_dealership
    ON public.sms_sequence_sends(dealership_id);

-- ---------------------------------------------------------------------------
-- dealership_events — immutable-ish event log feeding webhook dispatch
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dealership_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    event TEXT NOT NULL
        CHECK (event IN ('deal.created', 'lead.created', 'inventory.updated', 'payment.received')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealership_events_dealership
    ON public.dealership_events(dealership_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- webhook_deliveries — per-endpoint delivery log with signature + http status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.dealership_events(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    webhook_id TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    http_status INTEGER,
    response TEXT,
    error TEXT,
    signature TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_dealership
    ON public.webhook_deliveries(dealership_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_sms_sequences_updated_at ON public.sms_sequences;
CREATE TRIGGER update_sms_sequences_updated_at
    BEFORE UPDATE ON public.sms_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_sequence_steps_updated_at ON public.sms_sequence_steps;
CREATE TRIGGER update_sms_sequence_steps_updated_at
    BEFORE UPDATE ON public.sms_sequence_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_sequence_enrollments_updated_at ON public.sms_sequence_enrollments;
CREATE TRIGGER update_sms_sequence_enrollments_updated_at
    BEFORE UPDATE ON public.sms_sequence_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_sequence_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- sms_messages: full CRUD for dealership members (inbound webhooks use service role)
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_messages_select_policy' AND polrelid = 'public.sms_messages'::regclass) THEN
        CREATE POLICY sms_messages_select_policy ON public.sms_messages
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_messages_insert_policy' AND polrelid = 'public.sms_messages'::regclass) THEN
        CREATE POLICY sms_messages_insert_policy ON public.sms_messages
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_messages_update_policy' AND polrelid = 'public.sms_messages'::regclass) THEN
        CREATE POLICY sms_messages_update_policy ON public.sms_messages
            FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;

    -- sms_sequences
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequences_select_policy' AND polrelid = 'public.sms_sequences'::regclass) THEN
        CREATE POLICY sms_sequences_select_policy ON public.sms_sequences
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequences_insert_policy' AND polrelid = 'public.sms_sequences'::regclass) THEN
        CREATE POLICY sms_sequences_insert_policy ON public.sms_sequences
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequences_update_policy' AND polrelid = 'public.sms_sequences'::regclass) THEN
        CREATE POLICY sms_sequences_update_policy ON public.sms_sequences
            FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequences_delete_policy' AND polrelid = 'public.sms_sequences'::regclass) THEN
        CREATE POLICY sms_sequences_delete_policy ON public.sms_sequences
            FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;

    -- sms_sequence_steps
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_steps_select_policy' AND polrelid = 'public.sms_sequence_steps'::regclass) THEN
        CREATE POLICY sms_sequence_steps_select_policy ON public.sms_sequence_steps
            FOR SELECT USING (
                sequence_id IN (SELECT id FROM public.sms_sequences WHERE dealership_id = get_user_dealership_id())
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_steps_insert_policy' AND polrelid = 'public.sms_sequence_steps'::regclass) THEN
        CREATE POLICY sms_sequence_steps_insert_policy ON public.sms_sequence_steps
            FOR INSERT WITH CHECK (
                sequence_id IN (SELECT id FROM public.sms_sequences WHERE dealership_id = get_user_dealership_id())
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_steps_update_policy' AND polrelid = 'public.sms_sequence_steps'::regclass) THEN
        CREATE POLICY sms_sequence_steps_update_policy ON public.sms_sequence_steps
            FOR UPDATE USING (
                sequence_id IN (SELECT id FROM public.sms_sequences WHERE dealership_id = get_user_dealership_id())
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_steps_delete_policy' AND polrelid = 'public.sms_sequence_steps'::regclass) THEN
        CREATE POLICY sms_sequence_steps_delete_policy ON public.sms_sequence_steps
            FOR DELETE USING (
                sequence_id IN (SELECT id FROM public.sms_sequences WHERE dealership_id = get_user_dealership_id())
            );
    END IF;

    -- sms_sequence_enrollments
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_enrollments_select_policy' AND polrelid = 'public.sms_sequence_enrollments'::regclass) THEN
        CREATE POLICY sms_sequence_enrollments_select_policy ON public.sms_sequence_enrollments
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_enrollments_insert_policy' AND polrelid = 'public.sms_sequence_enrollments'::regclass) THEN
        CREATE POLICY sms_sequence_enrollments_insert_policy ON public.sms_sequence_enrollments
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_enrollments_update_policy' AND polrelid = 'public.sms_sequence_enrollments'::regclass) THEN
        CREATE POLICY sms_sequence_enrollments_update_policy ON public.sms_sequence_enrollments
            FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_enrollments_delete_policy' AND polrelid = 'public.sms_sequence_enrollments'::regclass) THEN
        CREATE POLICY sms_sequence_enrollments_delete_policy ON public.sms_sequence_enrollments
            FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;

    -- sms_sequence_sends
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_sends_select_policy' AND polrelid = 'public.sms_sequence_sends'::regclass) THEN
        CREATE POLICY sms_sequence_sends_select_policy ON public.sms_sequence_sends
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sms_sequence_sends_insert_policy' AND polrelid = 'public.sms_sequence_sends'::regclass) THEN
        CREATE POLICY sms_sequence_sends_insert_policy ON public.sms_sequence_sends
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;

    -- dealership_events: select only (inserts happen via service role on write paths)
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'dealership_events_select_policy' AND polrelid = 'public.dealership_events'::regclass) THEN
        CREATE POLICY dealership_events_select_policy ON public.dealership_events
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;

    -- webhook_deliveries
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'webhook_deliveries_select_policy' AND polrelid = 'public.webhook_deliveries'::regclass) THEN
        CREATE POLICY webhook_deliveries_select_policy ON public.webhook_deliveries
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;
