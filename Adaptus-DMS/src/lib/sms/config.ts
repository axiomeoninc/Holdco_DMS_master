/**
 * SMS provider configuration.
 * Provider-agnostic: a "twilio" path is available and gated on real env.
 * Never fake a send — when credentials are absent, senders return NOT_CONFIGURED.
 */

export type SmsProviderName = "twilio";

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export function twilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_FROM_NUMBER || "",
    configured: isTwilioConfigured(),
  };
}

/** Amber "not configured" payload shared by SMS callers. */
export const SMS_NOT_CONFIGURED_MESSAGE =
  "SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER in Worker env. No message was sent.";

/** Default dealership quiet-hours window (local to dealership). */
export const DEFAULT_QUIET_HOURS = {
  enabled: false,
  start: "21:00", // 9:00 PM local
  end: "09:00", // 9:00 AM local
  timezone: "America/Toronto",
};

export type QuietHoursConfig = {
  enabled?: boolean;
  start?: string; // "HH:MM" 24h
  end?: string; // "HH:MM" 24h
  timezone?: string;
};

/** Standard SMS opt-out keywords (EN + FR for Canada). */
export const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "arrêt",
  "arreter",
  "neplus",
]);

export const OPT_OUT_CONFIRMATION =
  "You're unsubscribed from texts from this dealership. No more messages will be sent. Reply HELP for help.";
