"use client";

// src/components/ui/Avatar.tsx
// F-09 of v3 master plan. Replaces the DOM-mutation avatar fallback in
// Sidebar with a proper state-based component. Chain: image -> initials
// (color hashed from name) -> silhouette icon.

import { useState } from "react";
import { User } from "lucide-react";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
    "2xl": "h-24 w-24 text-2xl",
};

const ICON_SIZES: Record<AvatarSize, number> = {
    xs: 12,
    sm: 14,
    md: 18,
    lg: 22,
    xl: 28,
    "2xl": 40,
};

// 12 visually-distinct background colors for initials. Hash by name.
const PALETTE = [
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
];

function hashName(name: string | null | undefined): number {
    if (!name) return 0;
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function getInitials(name: string | null | undefined): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
    src?: string | null;
    name?: string | null;
    email?: string | null;
    size?: AvatarSize;
    className?: string;
    /** Show a ring around the avatar (for active/selected state). */
    ring?: boolean;
    /** Loading behavior. "eager" for hero contexts, "lazy" for list rows. */
    loading?: "eager" | "lazy";
}

export function Avatar({ src, name, email, size = "md", className = "", ring = false, loading = "lazy" }: AvatarProps) {
    const [errored, setErrored] = useState(false);
    const showImage = src && !errored;
    const displayName = name || email || "";
    const initials = getInitials(displayName);
    const palette = PALETTE[hashName(displayName) % PALETTE.length];

    return (
        <div
            className={[
                "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold uppercase select-none",
                SIZE_CLASSES[size],
                ring ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                showImage ? "bg-muted" : palette,
                className,
            ].join(" ")}
            aria-label={displayName || "User"}
        >
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src!}
                    alt={displayName || ""}
                    loading={loading}
                    onError={() => setErrored(true)}
                    className="h-full w-full object-cover"
                />
            ) : initials !== "?" ? (
                <span aria-hidden>{initials}</span>
            ) : (
                <User className="opacity-70" width={ICON_SIZES[size]} height={ICON_SIZES[size]} />
            )}
        </div>
    );
}
