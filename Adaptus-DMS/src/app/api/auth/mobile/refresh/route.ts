// POST /api/auth/mobile/refresh
// Rotates the access token from HttpOnly session cookies, or { refresh_token }.

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/src/lib/trial";
import {
  applyPendingCookies,
  createMobileSessionClient,
  parseMobileRefreshBody,
  readJsonBody,
} from "@/src/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }

    const parsed = parseMobileRefreshBody(parsedBody.value);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const ip = clientIp(req);
    const limit = checkRateLimit(`mobile-refresh:${ip}`, 30, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many refresh attempts. Try again later." },
        { status: 429 }
      );
    }

    const { supabase, pendingCookies, secure, sessionMaxAge } =
      await createMobileSessionClient(req);

    const refreshArg = parsed.value.refresh_token
      ? { refresh_token: parsed.value.refresh_token }
      : undefined;

    const { data, error } = await supabase.auth.refreshSession(refreshArg);

    if (error || !data?.session) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      data: {
        access_token: data.session.access_token,
        expires_in: data.session.expires_in,
      },
    });

    applyPendingCookies(response, pendingCookies, {
      secure,
      maxAge: sessionMaxAge,
    });

    return response;
  } catch (err) {
    console.error("Mobile refresh error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
