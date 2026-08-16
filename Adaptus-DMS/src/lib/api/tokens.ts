/**
 * Dealership API tokens for the public read API (src/app/api/external/**).
 *
 * Storage: dealerships.settings.api_tokens — an array of
 *   { id, name, prefix, hash, scopes[], created_at, last_used_at }
 * Only the SHA-256 hash of the token is persisted; the raw token is shown
 * exactly once at creation.
 */

import { sha256Hex } from "@/src/lib/trial";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

export type ApiTokenRecord = {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};

export const API_SCOPES = ["inventory:read", "leads:read", "deals:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

function apiSecret(): string {
  return (
    process.env.API_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-api-token-secret"
  );
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `ffapi_${hex}`;
}

function readTokens(settings: Record<string, unknown> | null | undefined): ApiTokenRecord[] {
  const raw = settings?.api_tokens;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is ApiTokenRecord => {
    if (!t || typeof t !== "object") return false;
    const rec = t as Record<string, unknown>;
    return (
      typeof rec.id === "string" &&
      typeof rec.name === "string" &&
      typeof rec.hash === "string" &&
      typeof rec.prefix === "string" &&
      Array.isArray(rec.scopes)
    );
  });
}

export async function listApiTokens(dealershipId: string): Promise<
  | { ok: true; tokens: Array<Omit<ApiTokenRecord, "hash">> }
  | { ok: false; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const tokens = readTokens((data?.settings || {}) as Record<string, unknown>).map(
    (t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      scopes: t.scopes,
      created_at: t.created_at,
      last_used_at: t.last_used_at,
    })
  );
  return { ok: true, tokens };
}

export async function createApiToken(opts: {
  dealershipId: string;
  name: string;
  scopes: ApiScope[];
}): Promise<
  | { ok: true; token: string; record: Omit<ApiTokenRecord, "hash"> }
  | { ok: false; error: string }
> {
  const scopes = opts.scopes.filter((s) => (API_SCOPES as readonly string[]).includes(s));
  if (scopes.length === 0) {
    return { ok: false, error: "At least one scope is required" };
  }
  if (opts.name.length > 100) {
    return { ok: false, error: "Token name too long" };
  }

  const raw = await generateRawToken();
  const hash = await sha256Hex(`${raw}:${apiSecret()}`);

  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", opts.dealershipId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const settings = {
    ...((data?.settings || {}) as Record<string, unknown>),
  };
  const tokens = readTokens(settings);
  const record: ApiTokenRecord = {
    id: crypto.randomUUID(),
    name: opts.name.trim(),
    prefix: raw.slice(0, 10),
    hash,
    scopes,
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  tokens.push(record);

  const { error: updateErr } = await supabaseAdmin
    .from("dealerships")
    .update({ settings: { ...settings, api_tokens: tokens } })
    .eq("id", opts.dealershipId);
  if (updateErr) return { ok: false, error: updateErr.message };

  return {
    ok: true,
    token: raw,
    record: {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes,
      created_at: record.created_at,
      last_used_at: record.last_used_at,
    },
  };
}

async function generateRawToken(): Promise<string> {
  return randomToken();
}

export async function revokeApiToken(
  dealershipId: string,
  tokenId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const settings = { ...((data?.settings || {}) as Record<string, unknown>) };
  const tokens = readTokens(settings).filter((t) => t.id !== tokenId);
  const { error: updateErr } = await supabaseAdmin
    .from("dealerships")
    .update({ settings: { ...settings, api_tokens: tokens } })
    .eq("id", dealershipId);
  if (updateErr) return { ok: false, error: updateErr.message };
  return { ok: true };
}

export async function touchApiToken(
  dealershipId: string,
  tokenId: string
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .maybeSingle();
  if (error || !data) return;
  const settings = { ...((data.settings || {}) as Record<string, unknown>) };
  const tokens = readTokens(settings).map((t) =>
    t.id === tokenId ? { ...t, last_used_at: new Date().toISOString() } : t
  );
  await supabaseAdmin
    .from("dealerships")
    .update({ settings: { ...settings, api_tokens: tokens } })
    .eq("id", dealershipId);
}

/**
 * Resolve an API token to its dealership + scopes, or null.
 * Timing-safe hash comparison via sha256Hex.
 */
export async function resolveApiToken(
  rawToken: string
): Promise<{ dealershipId: string; tokenId: string; scopes: ApiScope[] } | null> {
  if (!rawToken || !rawToken.startsWith("ffapi_")) return null;
  const hash = await sha256Hex(`${rawToken}:${apiSecret()}`);

  const { data: dealers, error } = await supabaseAdmin
    .from("dealerships")
    .select("id, settings")
    .limit(500);
  if (error) return null;

  for (const dealer of dealers || []) {
    const tokens = readTokens((dealer.settings || {}) as Record<string, unknown>);
    for (const t of tokens) {
      if (t.hash.length === hash.length) {
        let mismatch = 0;
        for (let i = 0; i < hash.length; i++) {
          mismatch |= hash.charCodeAt(i) ^ t.hash.charCodeAt(i);
        }
        if (mismatch === 0) {
          void touchApiToken(dealer.id, t.id);
          return {
            dealershipId: dealer.id,
            tokenId: t.id,
            scopes: t.scopes as ApiScope[],
          };
        }
      }
    }
  }
  return null;
}

/** Pull the bearer/x-api-key token off a public request. */
export function extractApiToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (/^Bearer\s+.+/i.test(auth)) return auth.slice(7).trim();
  const xKey = req.headers.get("x-api-key");
  if (xKey) return xKey.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("api_key");
  if (q) return q.trim();
  return null;
}
