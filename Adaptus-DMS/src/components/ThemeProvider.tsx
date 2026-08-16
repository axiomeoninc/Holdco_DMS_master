"use client";

// src/components/ThemeProvider.tsx
// Wraps next-themes for the dashboard shell only (not auth routes).
//
// OpenNext/Cloudflare production bundling can inject esbuild `keepNames`
// helpers (`__name(...)`) into next-themes' FOUC inline script without
// defining `__name`, which throws on /login and blocks client boot.
// Auth layouts intentionally omit this provider; the polyfill below is
// defense-in-depth for dashboard theme scripts.

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import type { ReactNode } from "react";

/** esbuild keepNames polyfill — safe no-op if already defined. */
export const ESBUILD_NAME_HELPER =
    "var __name=function(t,v){try{Object.defineProperty(t,'name',{value:v,configurable:!0})}catch(e){}return t};";

export function ThemeProvider({
    children,
    ...props
}: ThemeProviderProps & { children: ReactNode }) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
