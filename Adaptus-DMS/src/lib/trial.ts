// src/lib/trial.ts
// DB-enforced SaaS trial helpers. Existing dealerships with
// subscription_status=active (or null legacy) are never auto-expired.

import { supabaseAdmin } from "./supabase-admin";

export type SubscriptionStatus = "trialing" | "active" | "expired" | "canceled";

export type DealershipTrialRow = {
  id: string;
  name: string | null;
  subscription_status: SubscriptionStatus | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  status?: string | null;
};

export const TRIAL_DAYS = 7;

export function trialWindowFromNow(nowMs = Date.now()): {
  trial_starts_at: string;
  trial_ends_at: string;
} {
  const starts = new Date(nowMs);
  const ends = new Date(nowMs + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return {
    trial_starts_at: starts.toISOString(),
    trial_ends_at: ends.toISOString(),
  };
}

/**
 * True when this tenant should be soft-locked (writes + dashboard blocked).
 * Grandfather rule: active / canceled / null status / missing trial_ends_at → not locked.
 */
export function isTrialSoftLocked(
  dealership: Pick<
    DealershipTrialRow,
    "subscription_status" | "trial_ends_at"
  > | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!dealership) return false;
  const status = dealership.subscription_status;
  if (!status || status === "active" || status === "canceled") return false;
  if (status === "expired") return true;
  if (status === "trialing") {
    if (!dealership.trial_ends_at) return false; // incomplete row → do not lock
    return new Date(dealership.trial_ends_at).getTime() <= nowMs;
  }
  return false;
}

export function daysRemainingInTrial(
  trialEndsAt: string | null | undefined,
  nowMs = Date.now()
): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - nowMs;
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Load dealership trial fields. If trialing past end, flip to expired (idempotent).
 */
export async function getDealershipTrialState(
  dealershipId: string,
  nowMs = Date.now()
): Promise<{
  dealership: DealershipTrialRow | null;
  softLocked: boolean;
  daysRemaining: number | null;
  flippedToExpired: boolean;
}> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("id, name, subscription_status, trial_starts_at, trial_ends_at, status")
    .eq("id", dealershipId)
    .maybeSingle();

  if (error || !data) {
    return {
      dealership: null,
      softLocked: false,
      daysRemaining: null,
      flippedToExpired: false,
    };
  }

  let dealership = data as DealershipTrialRow;
  let flippedToExpired = false;

  if (
    dealership.subscription_status === "trialing" &&
    dealership.trial_ends_at &&
    new Date(dealership.trial_ends_at).getTime() <= nowMs
  ) {
    const { data: updated } = await supabaseAdmin
      .from("dealerships")
      .update({
        subscription_status: "expired",
        status: "Suspended",
        updated_at: new Date(nowMs).toISOString(),
      })
      .eq("id", dealershipId)
      .eq("subscription_status", "trialing")
      .select("id, name, subscription_status, trial_starts_at, trial_ends_at, status")
      .maybeSingle();

    if (updated) {
      dealership = updated as DealershipTrialRow;
      flippedToExpired = true;
    } else {
      dealership = { ...dealership, subscription_status: "expired" };
      flippedToExpired = true;
    }
  }

  const softLocked = isTrialSoftLocked(dealership, nowMs);
  const daysRemaining =
    dealership.subscription_status === "trialing"
      ? daysRemainingInTrial(dealership.trial_ends_at, nowMs)
      : dealership.subscription_status === "expired"
        ? 0
        : null;

  return { dealership, softLocked, daysRemaining, flippedToExpired };
}

export function trialExpiredResponse() {
  return {
    error: "Trial expired",
    code: "TRIAL_EXPIRED",
    message:
      "Your 7-day trial has ended. Contact AdaptUs to upgrade. Your data is retained.",
  };
}

/** Simple in-memory rate limit (per isolate). Good enough for Worker soft limits. */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function clientIp(req: { headers: Headers }): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

export function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function isStrongPassword(password: string): string | null {
  if (!password || password.length < 12) {
    return "Password must be at least 12 characters";
  }
  if (password === "Password@123" || password.toLowerCase() === "password") {
    return "Password is too common; please choose a stronger one";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include letters and numbers";
  }
  return null;
}
