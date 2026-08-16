// Pure parsers for /api/auth/mobile/* — no Supabase imports (unit-testable).

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type MobileLoginInput = {
  email: string;
  password: string;
};

export type MobileRefreshInput = {
  refresh_token?: string;
};

export type PushTokenInput = {
  token: string;
  platform: "ios" | "android";
};

export function parseBearerAuthorization(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1] ?? null;
}

export function parseMobileLoginBody(body: unknown): ParseResult<MobileLoginInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Email and password are required" };
  }
  const rec = body as Record<string, unknown>;
  const email = typeof rec.email === "string" ? rec.email.trim().toLowerCase() : "";
  const password = typeof rec.password === "string" ? rec.password : "";
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  if (!email.includes("@")) {
    return { ok: false, error: "Invalid email address" };
  }
  return { ok: true, value: { email, password } };
}

export function parseMobileRefreshBody(body: unknown): ParseResult<MobileRefreshInput> {
  if (body === null || body === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const rec = body as Record<string, unknown>;
  if (rec.refresh_token === undefined || rec.refresh_token === null || rec.refresh_token === "") {
    return { ok: true, value: {} };
  }
  if (typeof rec.refresh_token !== "string") {
    return { ok: false, error: "refresh_token must be a string" };
  }
  const refresh_token = rec.refresh_token.trim();
  if (!refresh_token) {
    return { ok: true, value: {} };
  }
  return { ok: true, value: { refresh_token } };
}

export function parsePushTokenBody(body: unknown): ParseResult<PushTokenInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "token and platform are required" };
  }
  const rec = body as Record<string, unknown>;
  const token = typeof rec.token === "string" ? rec.token.trim() : "";
  const platform = rec.platform;
  if (!token) {
    return { ok: false, error: "token is required" };
  }
  if (platform !== "ios" && platform !== "android") {
    return { ok: false, error: 'platform must be "ios" or "android"' };
  }
  return { ok: true, value: { token, platform } };
}
