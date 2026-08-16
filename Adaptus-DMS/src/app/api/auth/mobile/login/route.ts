// POST /api/auth/mobile/login
// Cookie-backed refresh (HttpOnly, same as web). JSON returns access_token only.

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/src/lib/trial";
import {
  applyPendingCookies,
  createMobileSessionClient,
  loadMobileMeUser,
  loadUserRow,
  logMobileLoginAttempt,
  parseMobileLoginBody,
  readJsonBody,
} from "@/src/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }

    const parsed = parseMobileLoginBody(parsedBody.value);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { email, password } = parsed.value;

    const ip = clientIp(req);
    const limit = checkRateLimit(`mobile-login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }

    const { supabase, pendingCookies, secure, sessionMaxAge } =
      await createMobileSessionClient(req);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session || !data.user) {
      await logMobileLoginAttempt(
        null,
        email,
        false,
        error instanceof Error ? error.message : "Invalid credentials",
        req,
        null
      );
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const userProfile = await loadUserRow(data.user.id);

    if (userProfile && !userProfile.is_active) {
      await supabase.auth.signOut();
      const suspended = NextResponse.json(
        { error: "Account is suspended. Please contact your administrator." },
        { status: 403 }
      );
      applyPendingCookies(suspended, pendingCookies, { secure, expire: true });
      return suspended;
    }

    if (
      userProfile &&
      userProfile.email_verified_at === null &&
      !data.user.email_confirmed_at
    ) {
      await supabase.auth.signOut();
      const unverified = NextResponse.json(
        {
          error: "Email not verified. Check your inbox for the verification code.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
      applyPendingCookies(unverified, pendingCookies, { secure, expire: true });
      return unverified;
    }

    await logMobileLoginAttempt(
      data.user.id,
      email,
      true,
      null,
      req,
      userProfile?.dealership_id || null
    );

    const user = await loadMobileMeUser(data.user.id, data.user.email ?? email);

    const response = NextResponse.json({
      data: {
        access_token: data.session.access_token,
        expires_in: data.session.expires_in,
        user,
      },
    });

    applyPendingCookies(response, pendingCookies, {
      secure,
      maxAge: sessionMaxAge,
    });

    return response;
  } catch (err) {
    console.error("Mobile login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
