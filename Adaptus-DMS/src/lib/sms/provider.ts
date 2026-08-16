/**
 * SMS send orchestrator — the single chokepoint for outbound text.
 *
 * Guards (in order):
 *  1. consent        — CASL/TCPA sms_consent must be true (assertSmsConsent)
 *  2. quiet hours    — blocked inside the dealership's quiet window
 *  3. provider       — real Twilio call; amber NOT_CONFIGURED when creds missing
 *  4. record         — every attempt is logged to sms_messages with honest status
 *
 * Never fabricates a send. A blocked/skipped/failed message is recorded as
 * exactly that.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSmsConsent, SmsConsentError } from "@/src/lib/sms-consent";
import { isTwilioConfigured, SMS_NOT_CONFIGURED_MESSAGE } from "./config";
import { isWithinQuietHours, quietHoursFromSettings } from "./quiet-hours";
import { sendViaTwilio } from "./twilio";
import { appOrigin } from "@/src/lib/casl-unsubscribe";

export type SmsSendOutcome =
  | {
      ok: true;
      status: "sent";
      smsMessageId?: string;
      providerSid?: string | null;
    }
  | {
      ok: false;
      code:
        | "SMS_CONSENT_REQUIRED"
        | "NO_PHONE"
        | "QUIET_HOURS"
        | "NOT_CONFIGURED"
        | "SEND_FAILED";
      error: string;
      smsMessageId?: string;
    };

export type SmsRecipient = {
  id?: string | null;
  phone?: string | null;
  sms_consent?: boolean | null;
  dealership_id?: string | null;
  name?: string | null;
};

export async function sendSmsMessage(
  supabase: SupabaseClient,
  opts: {
    dealershipId: string;
    customer: SmsRecipient | null | undefined;
    body: string;
    /** When true, quiet-hours and consent are enforced (marketing). */
    marketing?: boolean;
    ignoreQuietHours?: boolean;
    /** Persist a sms_messages row even on pre-send rejection. */
    recordBlocked?: boolean;
    source?: string;
  }
): Promise<SmsSendOutcome> {
  const record = async (fields: {
    status: string;
    error?: string | null;
    providerSid?: string | null;
    quietHoursBlocked?: boolean;
    sentAt?: string | null;
  }) => {
    const { data } = await supabase
      .from("sms_messages")
      .insert({
        dealership_id: opts.dealershipId,
        customer_id: opts.customer?.id || null,
        direction: "outbound",
        phone: opts.customer?.phone || "",
        body: opts.body,
        status: fields.status,
        consent_checked: true,
        quiet_hours_blocked: Boolean(fields.quietHoursBlocked),
        provider: isTwilioConfigured() ? "twilio" : null,
        provider_sid: fields.providerSid ?? null,
        error: fields.error ?? null,
        sent_at: fields.sentAt ?? null,
      })
      .select("id")
      .single();
    return data?.id as string | undefined;
  };

  // 1. Consent
  try {
    assertSmsConsent(opts.customer);
  } catch (e) {
    const msg = e instanceof SmsConsentError ? e.message : "SMS consent required";
    const smsMessageId = opts.recordBlocked
      ? await record({ status: "blocked", error: msg })
      : undefined;
    return { ok: false, code: "SMS_CONSENT_REQUIRED", error: msg, smsMessageId };
  }

  const phone = (opts.customer?.phone || "").trim();
  if (!phone) {
    const smsMessageId = opts.recordBlocked
      ? await record({ status: "blocked", error: "No phone number" })
      : undefined;
    return { ok: false, code: "NO_PHONE", error: "Customer has no phone number", smsMessageId };
  }

  // 2. Quiet hours (marketing sends only)
  if (opts.marketing && !opts.ignoreQuietHours) {
    const { data: dealer } = await supabase
      .from("dealerships")
      .select("settings")
      .eq("id", opts.dealershipId)
      .maybeSingle();
    const settings = (dealer?.settings || {}) as Record<string, unknown>;
    const qh = quietHoursFromSettings(settings);
    if (isWithinQuietHours(new Date(), qh)) {
      const smsMessageId = opts.recordBlocked
        ? await record({ status: "blocked", quietHoursBlocked: true, error: "quiet hours" })
        : undefined;
      return {
        ok: false,
        code: "QUIET_HOURS",
        error: `Cannot send right now — outside allowed hours (${qh.start}–${qh.end} ${qh.timezone}).`,
        smsMessageId,
      };
    }
  }

  // 3. Provider
  if (!isTwilioConfigured()) {
    const smsMessageId = opts.recordBlocked
      ? await record({ status: "skipped", error: SMS_NOT_CONFIGURED_MESSAGE })
      : undefined;
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      error: SMS_NOT_CONFIGURED_MESSAGE,
      smsMessageId,
    };
  }

  const statusCallback = `${appOrigin()}/api/sms/status`;
  const sent = await sendViaTwilio({ to: phone, body: opts.body, statusCallback });

  if (!sent.ok) {
    const smsMessageId = opts.recordBlocked
      ? await record({ status: "failed", error: sent.error })
      : await record({ status: "failed", error: sent.error });
    return { ok: false, code: "SEND_FAILED", error: sent.error, smsMessageId };
  }

  const smsMessageId = await record({
    status: "sent",
    providerSid: sent.providerSid,
    sentAt: new Date().toISOString(),
  });

  return { ok: true, status: "sent", smsMessageId, providerSid: sent.providerSid };
}
