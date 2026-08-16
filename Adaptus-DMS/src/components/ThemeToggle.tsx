"use client";

// src/components/ThemeToggle.tsx
// Light/dark/system toggle for the dashboard header. Renders a 3-state
// segmented control.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Avoid hydration mismatch — render a stable placeholder until mounted.
    if (!mounted) {
        return (
            <div
                aria-hidden
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
            >
                {OPTIONS.map((o) => (
                    <div key={o.value} className="h-7 w-9 rounded-lg" />
                ))}
            </div>
        );
    }

    const current = theme === "system" ? "system" : theme;
    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
        >
            {OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = current === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        onClick={() => setTheme(value)}
                        className={[
                            "inline-flex h-7 w-9 items-center justify-center rounded-lg transition-colors",
                            active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                );
            })}
        </div>
    );
}
