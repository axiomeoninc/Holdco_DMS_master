import type { NextConfig } from "next";
import {
    EMBED_FRAME_HEADERS,
    SECURITY_HEADERS,
} from "./src/lib/security-headers";

const SUPABASE_HOST = "zwfeitodxikdwymkieai.supabase.co";

const nextConfig: NextConfig = {
    // View Transitions: use React <ViewTransition> in app layouts (Next 16 / React 19.2).
    // No experimental.viewTransition flag — not in NextConfig types for 16.3.
    images: {
        // Use our custom Supabase loader so <Image> requests go through
        // /storage/v1/render/image/... with width/quality params.
        loader: "custom",
        loaderFile: "./supabase-image-loader.ts",
        // Allow non-Supabase image hosts (Hillz CDN, etc.) to be served
        // by Next.js's default optimizer.
        remotePatterns: [
            { protocol: "https", hostname: SUPABASE_HOST },
            { protocol: "https", hostname: "hillzcdn.ca" },
            { protocol: "https", hostname: "*.supabase.co" },
        ],
    },
    async redirects() {
        return [
            // Legacy bookmark / email CTA — real page is /register
            {
                source: "/signup",
                destination: "/register",
                permanent: true,
            },
        ];
    },
    async headers() {
        return [
            {
                source: "/embed",
                headers: EMBED_FRAME_HEADERS,
            },
            {
                source: "/embed/:path*",
                headers: EMBED_FRAME_HEADERS,
            },
            {
                source: "/showroom",
                headers: EMBED_FRAME_HEADERS,
            },
            {
                source: "/showroom/:path*",
                headers: EMBED_FRAME_HEADERS,
            },
            {
                // Dashboard + APIs stay unframed. Must not match /embed or /showroom
                // or X-Frame-Options: DENY would block the dealer-site iframe widget.
                source: "/((?!embed(?:/|$)|showroom(?:/|$)).*)",
                headers: SECURITY_HEADERS,
            },
            {
                // PWA manifest + install icons: safe to cache, fast revalidation.
                source: "/manifest.webmanifest",
                headers: [
                    { key: "Content-Type", value: "application/manifest+json" },
                    { key: "Cache-Control", value: "public, max-age=86400" },
                ],
            },
            {
                source: "/brand/:path*",
                headers: [
                    { key: "Cache-Control", value: "public, max-age=604800, immutable" },
                ],
            },
        ];
    },
};

export default nextConfig;
