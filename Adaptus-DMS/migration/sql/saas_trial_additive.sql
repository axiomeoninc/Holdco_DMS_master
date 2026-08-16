-- SaaS trial additive migration (safe for Nova / existing tenants)
-- Grandfathers all existing dealerships as active (never auto-expire).
-- Soft-lock fields apply only to new trial signups.

ALTER TABLE dealerships
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
    CHECK (subscription_status IS NULL OR subscription_status IN ('trialing', 'active', 'expired', 'canceled')),
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Vancouver',
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_province TEXT,
  ADD COLUMN IF NOT EXISTS address_postal TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS business_number TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Grandfather existing rows: active forever (no trial enforcement)
UPDATE dealerships
SET subscription_status = 'active',
    trial_starts_at = NULL,
    trial_ends_at = NULL
WHERE subscription_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_dealerships_subscription_status
  ON dealerships (subscription_status);

CREATE INDEX IF NOT EXISTS idx_dealerships_trial_ends_at
  ON dealerships (trial_ends_at)
  WHERE subscription_status = 'trialing';

-- OTP codes for signup / login verification
CREATE TABLE IF NOT EXISTS email_otp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login')),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otp_email_purpose
  ON email_otp (email, purpose)
  WHERE consumed_at IS NULL;

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens (user_id)
  WHERE consumed_at IS NULL;

-- Optional: track email verification on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Existing users are grandfathered as verified
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, NOW())
WHERE email_verified_at IS NULL;
