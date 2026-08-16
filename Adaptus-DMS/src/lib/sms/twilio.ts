/**
 * Twilio REST send adapter (fetch-based, no SDK dependency).
 * Returns the provider's real SID or an honest error — never a fake id.
 */

import { twilioConfig } from "./config";

export type SendSmsResult =
  | { ok: true; providerSid: string; status: string }
  | { ok: false; error: string; missingConfig?: boolean };

export async function sendViaTwilio(opts: {
  to: string;
  from?: string;
  body: string;
  statusCallback?: string;
}): Promise<SendSmsResult> {
  const cfg = twilioConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      missingConfig: true,
      error:
        "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are not configured.",
    };
  }

  const from = opts.from || cfg.fromNumber;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
  const auth = btoa(`${cfg.accountSid}:${cfg.authToken}`);
  const params = new URLSearchParams({
    To: opts.to,
    From: from,
    Body: opts.body,
  });
  if (opts.statusCallback) params.set("StatusCallback", opts.statusCallback);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const body = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      message?: string;
      code?: number;
      more_info?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        error:
          body.message || `Twilio error (${res.status})${body.code ? ` code ${body.code}` : ""}`,
      };
    }
    if (!body.sid) {
      return { ok: false, error: "Twilio did not return a message SID" };
    }
    return { ok: true, providerSid: body.sid, status: body.status || "queued" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reach Twilio",
    };
  }
}
