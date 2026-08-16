/**
 * Shared auth for the public read API (src/app/api/external/**).
 * Resolves the ffapi_ token and checks the required scope.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractApiToken, resolveApiToken, type ApiScope } from "./tokens";

export type ScopeResult =
  | { ok: true; dealershipId: string; scopes: ApiScope[] }
  | { ok: false; response: NextResponse };

export async function requireApiScope(
  req: NextRequest,
  scope: ApiScope
): Promise<ScopeResult> {
  const raw = extractApiToken(req);
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Missing API token. Provide `Authorization: Bearer <token>` or `x-api-key`.",
          docs: "/settings/integrations",
        },
        { status: 401 }
      ),
    };
  }

  const resolved = await resolveApiToken(raw);
  if (!resolved) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or revoked API token" }, { status: 401 }),
    };
  }
  if (!resolved.scopes.includes(scope)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `API token lacks scope: ${scope}` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, dealershipId: resolved.dealershipId, scopes: resolved.scopes };
}
