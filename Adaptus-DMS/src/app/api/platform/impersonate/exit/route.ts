// POST /api/platform/impersonate/exit — restore platform-admin session from stash

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  applyAuthCookieOptions,
  clearStashCookieOptions,
  decodeStash,
  IMPERSONATE_STASH_COOKIE,
  isSecureRequest,
} from "@/src/lib/impersonation";
import { NextRequest, NextResponse } from "next/server";

type PendingCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const secure = isSecureRequest(req);
    const stash = decodeStash(req.cookies.get(IMPERSONATE_STASH_COOKIE)?.value);

    if (!stash) {
      return NextResponse.json(
        { success: false, error: "No impersonation session to exit" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const pendingCookies: PendingCookie[] = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({
              name,
              value,
              options: options as Record<string, unknown>,
            });
            try {
              cookieStore.set(
                name,
                value,
                applyAuthCookieOptions(options as Record<string, unknown>, {
                  secure,
                }) as Parameters<typeof cookieStore.set>[2]
              );
            } catch {
              // Response cookies still apply below.
            }
          });
        },
      },
    });

    const { data, error } = await supabase.auth.setSession({
      access_token: stash.accessToken,
      refresh_token: stash.refreshToken,
    });

    if (error || !data.session) {
      console.error("Impersonate exit setSession failed:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message :
            "Failed to restore admin session. Sign in again as platform admin.",
        },
        { status: 500 }
      );
    }

    if (data.session.user.id !== stash.adminUserId) {
      return NextResponse.json(
        { success: false, error: "Restored session does not match stashed admin" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      admin: {
        id: stash.adminUserId,
        email: stash.adminEmail,
      },
    });

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(
        name,
        value,
        applyAuthCookieOptions(options, { secure }) as Parameters<
          typeof response.cookies.set
        >[2]
      );
    }

    response.cookies.set(
      IMPERSONATE_STASH_COOKIE,
      "",
      clearStashCookieOptions(secure) as Parameters<typeof response.cookies.set>[2]
    );

    return response;
  } catch (error: unknown) {
    console.error("Error exiting impersonation:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
