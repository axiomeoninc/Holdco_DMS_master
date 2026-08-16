// lib/supabase-browser.ts
// F-02 (revised): HttpOnly-enforced cookie-backed browser client.
//
// Why we override setAll() to be a no-op:
//   The auth-token cookie is set by the SERVER with httpOnly: true
//   (see src/app/api/auth/login/route.ts setAll callback). The browser
//   does NOT need to write the cookie — the server is the source of
//   truth and the middleware (src/middleware.ts) refreshes it on every
//   request. If the browser client were allowed to write the cookie,
//   it would re-set it as httpOnly: false (the default for client-side
//   cookies) and re-introduce the XSS exposure.
//
// What still works:
//   - supabaseBrowser.auth.getSession() reads the cookie via getAll()
//     (Document.cookie) which sees HttpOnly=false cookies but NOT
//     HttpOnly=true ones. So getSession() returns null on the client.
//     That's OK — the F-02 default is for the client to call /api/me
//     (which IS sent with the HttpOnly cookie) for session state.
//   - The middleware refreshes the cookie on every server request, so
//     the session is always alive when the user is signed in.
//
// If a feature truly needs client-side supabaseBrowser.auth.* calls,
// they should be migrated to /api/* endpoints instead.

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
        // The HttpOnly auth cookie is set by the server. The browser can
        // see it via Document.cookie ONLY if httpOnly is false. We
        // intentionally don't read it here — use /api/me instead.
        getAll() {
            if (typeof document === "undefined") return [];
            return document.cookie
                .split(/;\s*/)
                .filter(Boolean)
                .map((part) => {
                    const eq = part.indexOf("=");
                    if (eq < 0) return { name: part.trim(), value: "" };
                    return {
                        name: part.slice(0, eq).trim(),
                        value: decodeURIComponent(part.slice(eq + 1).trim()),
                    };
                });
        },
        // The browser must NEVER write the auth cookie. The server is
        // the source of truth; allowing the browser to write it would
        // re-introduce the httpOnly: false XSS exposure.
        setAll() {
            // No-op.
        },
    },
    global: {
        headers: {
            "User-Agent": "dms-client",
        },
    },
});
