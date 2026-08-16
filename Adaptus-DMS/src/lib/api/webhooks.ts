/**
 * Per-dealership webhook endpoints + event dispatch.
 *
 * Endpoints are stored in dealerships.settings.webhooks as
 *   { id, url, secret, events[], active, created_at }
 * Dispatch signs each payload with HMAC-SHA256 (X-FF-Signature) and records
 * every delivery in webhook_deliveries with the real HTTP result.
 */

import { supabaseAdmin } from "@/src/lib/supabase-admin";

export const WEBHOOK_EVENTS = [
  "deal.created",
  "lead.created",
  "inventory.updated",
  "payment.received",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookEndpoint = {
  id: string;
  url: string;
  secret: string | null;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
};

function webhookSecret(): string {
  return process.env.WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-webhook-secret";
}

function readWebhooks(settings: Record<string, unknown> | null | undefined): WebhookEndpoint[] {
  const raw = settings?.webhooks;
  if (!Array.isArray(raw)) return [];
  return raw.filter((w): w is WebhookEndpoint => {
    if (!w || typeof w !== "object") return false;
    const rec = w as Record<string, unknown>;
    return (
      typeof rec.id === "string" &&
      typeof rec.url === "string" &&
      Array.isArray(rec.events)
    );
  });
}

export async function listWebhookEndpoints(dealershipId: string): Promise<
  | { ok: true; webhooks: WebhookEndpoint[] }
  | { ok: false; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, webhooks: readWebhooks((data?.settings || {}) as Record<string, unknown>) };
}

export async function upsertWebhookEndpoint(
  dealershipId: string,
  input: {
    id?: string;
    url: string;
    secret?: string | null;
    events: string[];
    active?: boolean;
  }
): Promise<{ ok: true; webhook: WebhookEndpoint } | { ok: false; error: string }> {
  const url = input.url.trim();
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, error: "Webhook URL must be https://" };
  }
  const events = input.events.filter((e) =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e)
  );
  if (events.length === 0) {
    return { ok: false, error: "At least one event is required" };
  }

  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const settings = { ...((data?.settings || {}) as Record<string, unknown>) };
  const webhooks = readWebhooks(settings);

  let webhook: WebhookEndpoint;
  if (input.id) {
    const existing = webhooks.find((w) => w.id === input.id);
    if (!existing) return { ok: false, error: "Webhook not found" };
    webhook = {
      ...existing,
      url,
      secret:
        typeof input.secret === "string" && input.secret.length > 0
          ? input.secret
          : existing.secret,
      events: events as WebhookEvent[],
      active: input.active !== false,
    };
    const idx = webhooks.findIndex((w) => w.id === input.id);
    webhooks[idx] = webhook;
  } else {
    webhook = {
      id: crypto.randomUUID(),
      url,
      secret:
        typeof input.secret === "string" && input.secret.trim()
          ? input.secret.trim()
          : null,
      events: events as WebhookEvent[],
      active: input.active !== false,
      created_at: new Date().toISOString(),
    };
    webhooks.push(webhook);
  }

  const { error: updateErr } = await supabaseAdmin
    .from("dealerships")
    .update({ settings: { ...settings, webhooks } })
    .eq("id", dealershipId);
  if (updateErr) return { ok: false, error: updateErr.message };

  return { ok: true, webhook };
}

export async function deleteWebhookEndpoint(
  dealershipId: string,
  webhookId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const settings = { ...((data?.settings || {}) as Record<string, unknown>) };
  const webhooks = readWebhooks(settings).filter((w) => w.id !== webhookId);
  const { error: updateErr } = await supabaseAdmin
    .from("dealerships")
    .update({ settings: { ...settings, webhooks } })
    .eq("id", dealershipId);
  if (updateErr) return { ok: false, error: updateErr.message };
  return { ok: true };
}

async function signPayload(secret: string, body: string, ts: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}.${body}`)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type DispatchResult = {
  webhookId: string;
  url: string;
  ok: boolean;
  status: "sent" | "failed";
  httpStatus?: number;
  error?: string;
};

/** Dispatch a single webhook endpoint. Returns the real HTTP outcome. */
export async function dispatchToEndpoint(
  endpoint: WebhookEndpoint,
  opts: { event: string; payload: unknown; dealershipId: string; eventId?: string | null }
): Promise<DispatchResult> {
  const ts = new Date().toISOString();
  const body = JSON.stringify({
    event: opts.event,
    created_at: ts,
    dealership_id: opts.dealershipId,
    data: opts.payload,
  });
  const secret = endpoint.secret || webhookSecret();
  const signature = await signPayload(secret, body, ts);

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FF-Event": opts.event,
        "X-FF-Signature": `t=${ts},v1=${signature}`,
        "X-FF-Timestamp": ts,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => "");

    await supabaseAdmin.from("webhook_deliveries").insert({
      dealership_id: opts.dealershipId,
      event_id: opts.eventId || null,
      event: opts.event,
      webhook_id: endpoint.id,
      url: endpoint.url,
      status: res.ok ? "sent" : "failed",
      http_status: res.status,
      response: text.slice(0, 2000),
      signature,
      attempted_at: new Date().toISOString(),
    });

    return {
      webhookId: endpoint.id,
      url: endpoint.url,
      ok: res.ok,
      status: res.ok ? "sent" : "failed",
      httpStatus: res.status,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dispatch failed";
    await supabaseAdmin.from("webhook_deliveries").insert({
      dealership_id: opts.dealershipId,
      event_id: opts.eventId || null,
      event: opts.event,
      webhook_id: endpoint.id,
      url: endpoint.url,
      status: "failed",
      error: msg,
      signature,
      attempted_at: new Date().toISOString(),
    });
    return { webhookId: endpoint.id, url: endpoint.url, ok: false, status: "failed", error: msg };
  }
}

/**
 * Emit a dealership event: persist to dealership_events and dispatch to every
 * matching active endpoint. Safe to call on any write path.
 */
export async function emitDealershipEvent(opts: {
  dealershipId: string;
  event: WebhookEvent;
  payload: unknown;
}): Promise<DispatchResult[]> {
  const { data: dealer, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", opts.dealershipId)
    .maybeSingle();
  if (error) return [];

  const webhooks = readWebhooks((dealer?.settings || {}) as Record<string, unknown>).filter(
    (w) =>
      w.active &&
      (w.events as readonly string[]).includes(opts.event) &&
      /^https:\/\//i.test(w.url)
  );
  if (webhooks.length === 0) return [];

  const { data: eventRow } = await supabaseAdmin
    .from("dealership_events")
    .insert({
      dealership_id: opts.dealershipId,
      event: opts.event,
      payload: (opts.payload || {}) as object,
    })
    .select("id")
    .single();

  const results: DispatchResult[] = [];
  for (const wh of webhooks) {
    results.push(
      await dispatchToEndpoint(wh, {
        event: opts.event,
        payload: opts.payload,
        dealershipId: opts.dealershipId,
        eventId: eventRow?.id || null,
      })
    );
  }
  return results;
}
