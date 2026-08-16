/**
 * Real-time SMS opt-out (CASL/TCPA STOP handling).
 * A verified STOP reply flips sms_consent=false and records the timestamp.
 * Reuses the casl-unsubscribe secret model for inbound verification when a
 * Twilio auth token is present; without it, the route returns an honest
 * 501/401 rather than trusting unverified webhooks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { OPT_OUT_KEYWORDS } from "./config";

export function isOptOutKeyword(body: string | null | undefined): boolean {
  if (!body || typeof body !== "string") return false;
  const token = body.trim().toLowerCase().replace(/[^a-zà-ÿ]/gi, "");
  return OPT_OUT_KEYWORDS.has(token);
}

export type OptOutResult =
  | { ok: true; alreadyOff: boolean; customerId: string | null }
  | { ok: false; error: string };

/**
 * Applies a real-time opt-out for a phone number within a dealership:
 * flips sms_consent=false, records the consent timestamp, and stops any
 * active SMS sequence enrollments for that customer.
 */
export async function applyPhoneOptOut(
  supabase: SupabaseClient,
  opts: { dealershipId: string; phone: string; source?: string }
): Promise<OptOutResult> {
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, sms_consent, sms_consent_at, sms_consent_ip")
    .eq("dealership_id", opts.dealershipId)
    .ilike("phone", opts.phone.replace(/[^\d+]/g, ""))
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!customer) {
    return { ok: true, alreadyOff: true, customerId: null };
  }

  const wasOn = Boolean(customer.sms_consent);
  await supabase
    .from("customers")
    .update({
      sms_consent: false,
      sms_consent_at: wasOn ? new Date().toISOString() : customer.sms_consent_at,
      sms_consent_ip: null,
    })
    .eq("id", customer.id);

  // Stop any active SMS sequence enrollments for this customer.
  await supabase
    .from("sms_sequence_enrollments")
    .update({
      status: "stopped",
      next_send_at: null,
      stopped_at: new Date().toISOString(),
      stop_reason: opts.source || "opt_out",
    })
    .eq("dealership_id", opts.dealershipId)
    .eq("customer_id", customer.id)
    .eq("status", "active");

  return { ok: true, alreadyOff: !wasOn, customerId: customer.id };
}

/**
 * Verify a Twilio webhook request signature. When TWILIO_AUTH_TOKEN is not
 * set we cannot verify, so we return false — callers should reject with the
 * honest amber state instead of trusting an unverified webhook.
 */
export async function verifyTwilioWebhook(
  body: string,
  signatureHeader: string | null,
  url: string
): Promise<boolean> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signatureHeader) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(token),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(url + body)
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    // constant-time-ish compare
    if (expected.length !== signatureHeader.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}
