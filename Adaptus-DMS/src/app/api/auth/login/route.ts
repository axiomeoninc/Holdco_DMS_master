// app/api/auth/login/route.ts
// F-02: cookie-backed session. Cookies are set on the NextResponse object
// (canonical App Router pattern) so Set-Cookie survives reverse proxies.
// Host-only (no Domain), Secure on HTTPS, SameSite=Lax.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

const SESSION_MAX_AGE_DEFAULT = 60 * 60 * 24 * 7; // 7 days
const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30 days

function getDeviceType(userAgent: string): string {
  if (userAgent.includes("mobile") || userAgent.includes("android") || userAgent.includes("iphone")) {
    return "Mobile";
  }
  if (userAgent.includes("tablet") || userAgent.includes("ipad")) {
    return "Tablet";
  }
  return "Desktop";
}

async function logLoginAttempt(
  userId: string | null,
  email: string,
  success: boolean,
  failureReason: string | null,
  ipAddress: string,
  userAgent: string,
  dealershipId: string | null
) {
  try {
    const deviceType = getDeviceType(userAgent);

    const { error } = await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      email: email,
      success: success,
      failure_reason: failureReason,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: deviceType,
      dealership_id: dealershipId,
    });

    if (error) {
      console.error("Failed to log login attempt:", error);
    }
  } catch (err) {
    console.error("Exception logging login attempt:", err);
  }
}

function isSecureRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

function applyCookieOptions(
  options: Record<string, unknown> | undefined,
  {
    secure,
    maxAge,
  }: { secure: boolean; maxAge?: number }
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...options,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  };
  // Host-only cookies for dms.adaptusgroup.ca / workers.dev — never set Domain.
  delete merged.domain;
  if (typeof maxAge === "number") {
    merged.maxAge = maxAge;
  }
  return merged;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const rememberMe = Boolean(body?.rememberMe);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const secure = isSecureRequest(req);
    const sessionMaxAge = rememberMe ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_DEFAULT;

    // Collect cookies from signIn so we can attach them to the JSON response.
    const pendingCookies: Array<{
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }> = [];

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options: options as Record<string, unknown> });
            // Also update the request cookie store for subsequent reads in this handler.
            try {
              cookieStore.set(
                name,
                value,
                applyCookieOptions(options as Record<string, unknown>, {
                  secure,
                  maxAge: sessionMaxAge,
                }) as Parameters<typeof cookieStore.set>[2]
              );
            } catch {
              // cookieStore.set can throw in some edge contexts; response cookies still apply.
            }
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      await logLoginAttempt(
        null,
        email,
        false,
        error instanceof Error ? error.message : "Invalid credentials",
        ipAddress,
        userAgent,
        null
      );

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("role, full_name, phone, avatar, dealership_id, is_active, email_verified_at")
      .eq("id", data.user.id)
      .single();

    if (userProfile && !userProfile.is_active) {
      await supabase.auth.signOut();
      const suspended = NextResponse.json(
        { error: "Account is suspended. Please contact your administrator." },
        { status: 403 }
      );
      // Clear any session cookies that were queued before we signed out.
      for (const { name, value, options } of pendingCookies) {
        suspended.cookies.set(
          name,
          value,
          applyCookieOptions(options, { secure }) as Parameters<
            typeof suspended.cookies.set
          >[2]
        );
      }
      return suspended;
    }

    // New SaaS signups must verify OTP before login. Grandfathered users have
    // email_verified_at set by migration (or legacy email_confirmed_at).
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
      for (const { name, options } of pendingCookies) {
        unverified.cookies.set(
          name,
          "",
          applyCookieOptions(
            { ...options, maxAge: 0 },
            { secure }
          ) as Parameters<typeof unverified.cookies.set>[2]
        );
      }
      return unverified;
    }

    await logLoginAttempt(
      data.user.id,
      email,
      true,
      null,
      ipAddress,
      userAgent,
      userProfile?.dealership_id || null
    );

    // Refresh lives in HttpOnly session cookies only — never return
    // refresh_token on this JSON body (mobile uses /api/auth/mobile/*).
    const responseBody = {
      user: {
        ...data.user,
        role: userProfile?.role || null,
        full_name: userProfile?.full_name || null,
        phone: userProfile?.phone || null,
        avatar: userProfile?.avatar || null,
        dealership_id: userProfile?.dealership_id || null,
      },
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      rememberMe,
    };

    const response = NextResponse.json(responseBody);

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(
        name,
        value,
        applyCookieOptions(options, {
          secure,
          maxAge: sessionMaxAge,
        }) as Parameters<typeof response.cookies.set>[2]
      );
    }

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
