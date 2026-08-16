-- Phase 2 Lane C: Resend CRM email sequences
-- Idempotent. Applied via migration/scripts/apply-phase2-crm-email-sequences.mjs

CREATE TABLE IF NOT EXISTS public.email_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sequences_dealership
    ON public.email_sequences(dealership_id);

CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_email_sequence_steps_sequence
    ON public.email_sequence_steps(sequence_id);

CREATE TABLE IF NOT EXISTS public.email_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
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
    CONSTRAINT email_sequence_enrollments_target_chk
        CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_email_sequence_enrollments_dealership
    ON public.email_sequence_enrollments(dealership_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_enrollments_sequence
    ON public.email_sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_enrollments_lead
    ON public.email_sequence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_enrollments_customer
    ON public.email_sequence_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_enrollments_status
    ON public.email_sequence_enrollments(dealership_id, status);

-- One active enrollment per sequence + lead (when lead set)
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_seq_enroll_active_lead
    ON public.email_sequence_enrollments(sequence_id, lead_id)
    WHERE status = 'active' AND lead_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_seq_enroll_active_customer
    ON public.email_sequence_enrollments(sequence_id, customer_id)
    WHERE status = 'active' AND customer_id IS NOT NULL AND lead_id IS NULL;

CREATE TABLE IF NOT EXISTS public.email_sequence_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.email_sequence_enrollments(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES public.email_sequence_steps(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    to_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    resend_id TEXT,
    error TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sequence_sends_enrollment
    ON public.email_sequence_sends(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_sends_dealership
    ON public.email_sequence_sends(dealership_id);

DROP TRIGGER IF EXISTS update_email_sequences_updated_at ON public.email_sequences;
CREATE TRIGGER update_email_sequences_updated_at
    BEFORE UPDATE ON public.email_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_sequence_steps_updated_at ON public.email_sequence_steps;
CREATE TRIGGER update_email_sequence_steps_updated_at
    BEFORE UPDATE ON public.email_sequence_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_sequence_enrollments_updated_at ON public.email_sequence_enrollments;
CREATE TRIGGER update_email_sequence_enrollments_updated_at
    BEFORE UPDATE ON public.email_sequence_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequences_select_policy'
          AND polrelid = 'public.email_sequences'::regclass
    ) THEN
        CREATE POLICY email_sequences_select_policy ON public.email_sequences
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequences_insert_policy'
          AND polrelid = 'public.email_sequences'::regclass
    ) THEN
        CREATE POLICY email_sequences_insert_policy ON public.email_sequences
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequences_update_policy'
          AND polrelid = 'public.email_sequences'::regclass
    ) THEN
        CREATE POLICY email_sequences_update_policy ON public.email_sequences
            FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequences_delete_policy'
          AND polrelid = 'public.email_sequences'::regclass
    ) THEN
        CREATE POLICY email_sequences_delete_policy ON public.email_sequences
            FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_steps_select_policy'
          AND polrelid = 'public.email_sequence_steps'::regclass
    ) THEN
        CREATE POLICY email_sequence_steps_select_policy ON public.email_sequence_steps
            FOR SELECT USING (
                sequence_id IN (
                    SELECT id FROM public.email_sequences
                    WHERE dealership_id = get_user_dealership_id()
                )
            );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_steps_insert_policy'
          AND polrelid = 'public.email_sequence_steps'::regclass
    ) THEN
        CREATE POLICY email_sequence_steps_insert_policy ON public.email_sequence_steps
            FOR INSERT WITH CHECK (
                sequence_id IN (
                    SELECT id FROM public.email_sequences
                    WHERE dealership_id = get_user_dealership_id()
                )
            );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_steps_update_policy'
          AND polrelid = 'public.email_sequence_steps'::regclass
    ) THEN
        CREATE POLICY email_sequence_steps_update_policy ON public.email_sequence_steps
            FOR UPDATE USING (
                sequence_id IN (
                    SELECT id FROM public.email_sequences
                    WHERE dealership_id = get_user_dealership_id()
                )
            );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_steps_delete_policy'
          AND polrelid = 'public.email_sequence_steps'::regclass
    ) THEN
        CREATE POLICY email_sequence_steps_delete_policy ON public.email_sequence_steps
            FOR DELETE USING (
                sequence_id IN (
                    SELECT id FROM public.email_sequences
                    WHERE dealership_id = get_user_dealership_id()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_enrollments_select_policy'
          AND polrelid = 'public.email_sequence_enrollments'::regclass
    ) THEN
        CREATE POLICY email_sequence_enrollments_select_policy ON public.email_sequence_enrollments
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_enrollments_insert_policy'
          AND polrelid = 'public.email_sequence_enrollments'::regclass
    ) THEN
        CREATE POLICY email_sequence_enrollments_insert_policy ON public.email_sequence_enrollments
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_enrollments_update_policy'
          AND polrelid = 'public.email_sequence_enrollments'::regclass
    ) THEN
        CREATE POLICY email_sequence_enrollments_update_policy ON public.email_sequence_enrollments
            FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_enrollments_delete_policy'
          AND polrelid = 'public.email_sequence_enrollments'::regclass
    ) THEN
        CREATE POLICY email_sequence_enrollments_delete_policy ON public.email_sequence_enrollments
            FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_sends_select_policy'
          AND polrelid = 'public.email_sequence_sends'::regclass
    ) THEN
        CREATE POLICY email_sequence_sends_select_policy ON public.email_sequence_sends
            FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'email_sequence_sends_insert_policy'
          AND polrelid = 'public.email_sequence_sends'::regclass
    ) THEN
        CREATE POLICY email_sequence_sends_insert_policy ON public.email_sequence_sends
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
END $$;
