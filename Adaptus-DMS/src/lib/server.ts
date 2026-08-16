// lib/server.ts
// Canonical Supabase server client for the F-02 cookie-backed auth flow.
//
// Reads & writes Supabase auth cookies via Next.js's cookies() API so the
// session persists across requests. Use this for:
//   - Server Components (page.tsx with no "use client")
//   - Route Handlers (route.ts under app/api/**)
//
// If you have a NextRequest object (route handler) and need to honour a
// legacy `Authorization: Bearer <token>` header, use `createTokenClient`
// from `./server-token` instead.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export async function createClient(_req?: NextRequest) {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // `cookies().set` throws in Server Components (read-only).
                    // The middleware (proxy.ts) handles the write in that case.
                }
            },
        },
    });
}
