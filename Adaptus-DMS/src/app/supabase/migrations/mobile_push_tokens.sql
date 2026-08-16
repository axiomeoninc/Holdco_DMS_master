-- Mobile Expo push token persistence (FlashFender mobile)
-- Idempotent. No RLS policies here — Worker routes use supabaseAdmin /
-- pickSupabaseClient service-role until live tenant RLS is applied separately.
-- Do NOT apply rls_tenant_hardening.sql as part of this change.
--
-- Operator apply (project zwfeitodxikdwymkieai only):
--   node migration/scripts/apply-mobile-push-tokens.mjs
-- Or POST this SQL via Supabase Management API database/query with
-- SUPABASE_ACCESS_TOKEN from .env.local / handoff secrets (never commit tokens).

CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
    ON public.push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_dealership_id
    ON public.push_tokens(dealership_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_token
    ON public.push_tokens(token);
