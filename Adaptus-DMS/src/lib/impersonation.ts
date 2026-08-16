// Shared impersonation stash cookie helpers.
// Stash holds admin recovery tokens so Exit can restore the platform-admin session.
// Payload is AES-256-GCM sealed with IMPERSONATE_STASH_SECRET (not reversible base64).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";

export const IMPERSONATE_STASH_COOKIE = "ff_impersonate_stash";
/** Support sessions — short TTL; Exit must happen before expiry. */
export const IMPERSONATE_STASH_MAX_AGE = 60 * 60 * 2; // 2 hours

/** Client-safe copy when the stash secret is unset. Never include the secret value. */
export const IMPERSONATE_NOT_CONFIGURED_MESSAGE =
  "Impersonation is not configured. Session recovery is unavailable until an operator enables it.";

export function isImpersonateStashConfigured(): boolean {
  return Boolean(process.env.IMPERSONATE_STASH_SECRET);
}

const STASH_PREFIX = "v1.";

export type ImpersonateStash = {
  adminUserId: string;
  adminEmail: string;
  accessToken: string;
  refreshToken: string;
  targetUserId: string;
  targetEmail: string;
  targetFullName: string | null;
  targetRole: string | null;
  stashedAt: number;
};

function stashKey(): Buffer {
  const secret = process.env.IMPERSONATE_STASH_SECRET;
  if (!secret) {
    throw new Error(IMPERSONATE_NOT_CONFIGURED_MESSAGE);
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function isSecureRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

export function applyAuthCookieOptions(
  options: Record<string, unknown> | undefined,
  { secure, maxAge }: { secure: boolean; maxAge?: number }
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...options,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  };
  delete merged.domain;
  if (typeof maxAge === "number") {
    merged.maxAge = maxAge;
  }
  return merged;
}

export function encodeStash(stash: ImpersonateStash): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", stashKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(stash), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return STASH_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function parseStash(parsed: Partial<ImpersonateStash>): ImpersonateStash | null {
  if (
    typeof parsed.adminUserId !== "string" ||
    typeof parsed.refreshToken !== "string" ||
    typeof parsed.accessToken !== "string" ||
    typeof parsed.targetUserId !== "string"
  ) {
    return null;
  }
  return {
    adminUserId: parsed.adminUserId,
    adminEmail: typeof parsed.adminEmail === "string" ? parsed.adminEmail : "",
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    targetUserId: parsed.targetUserId,
    targetEmail:
      typeof parsed.targetEmail === "string" ? parsed.targetEmail : "",
    targetFullName:
      typeof parsed.targetFullName === "string" ? parsed.targetFullName : null,
    targetRole:
      typeof parsed.targetRole === "string" ? parsed.targetRole : null,
    stashedAt:
      typeof parsed.stashedAt === "number" ? parsed.stashedAt : Date.now(),
  };
}

export function decodeStash(raw: string | undefined): ImpersonateStash | null {
  if (!raw || !raw.startsWith(STASH_PREFIX)) return null;
  try {
    const buf = Buffer.from(raw.slice(STASH_PREFIX.length), "base64url");
    if (buf.length < 12 + 16) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", stashKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<ImpersonateStash>;
    return parseStash(parsed);
  } catch {
    return null;
  }
}

export function stashCookieOptions(secure: boolean): Record<string, unknown> {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: IMPERSONATE_STASH_MAX_AGE,
  };
}

export function clearStashCookieOptions(secure: boolean): Record<string, unknown> {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
