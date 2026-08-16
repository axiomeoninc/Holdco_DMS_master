// app/api/auth/logout/route.ts
// F-02: clear Supabase session cookies on the NextResponse (not only cookies() store)
// so Set-Cookie deletion headers reach the browser through reverse proxies.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function isSecureRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const secure = isSecureRequest(req);

    const pendingCookies: Array<{
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options: options as Record<string, unknown> });
            try {
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                secure,
                sameSite: "lax",
                path: "/",
              });
            } catch {
              // Response cookies still apply below.
            }
          });
        },
      },
    });

    // Local scope: this browser/session only. Global revoke would sign every
    // other desk and parallel E2E worker out of the shared QA admin.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    for (const { name, value, options } of pendingCookies) {
      const opts: Record<string, unknown> = {
        ...options,
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
      };
      delete opts.domain;
      response.cookies.set(
        name,
        value,
        opts as Parameters<typeof response.cookies.set>[2]
      );
    }
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
