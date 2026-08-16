/**
 * CASL unsubscribe token helpers (email footer → preference write).
 * Token is HMAC-style SHA-256 of email + server secret — not a session.
 */

import { sha256Hex } from "@/src/lib/trial";

function unsubscribeSecret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-casl-unsubscribe"
  );
}

export function normalizeUnsubscribeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function makeUnsubscribeToken(email: string): Promise<string> {
  const normalized = normalizeUnsubscribeEmail(email);
  return sha256Hex(`${normalized}:${unsubscribeSecret()}`);
}

export async function verifyUnsubscribeToken(
  email: string,
  token: string | null | undefined
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const expected = await makeUnsubscribeToken(email);
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://app.flashfender.com"
  ).replace(/\/$/, "");
}

export async function buildUnsubscribeUrl(email: string): Promise<string> {
  const token = await makeUnsubscribeToken(email);
  const params = new URLSearchParams({
    email: normalizeUnsubscribeEmail(email),
    token,
  });
  return `${appOrigin()}/unsubscribe?${params.toString()}`;
}
