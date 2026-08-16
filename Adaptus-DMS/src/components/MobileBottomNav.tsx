"use client";

// src/components/MobileBottomNav.tsx
// Mobile primary nav (<1024px). Solid white/card bar — no glass chrome.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Car, Briefcase, Wrench } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { apiFetch } from "@/src/lib/fetch";

const NAV = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/inventory", label: "Inventory", icon: Car },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/deals", label: "Deals", icon: Briefcase },
    { href: "/tasks", label: "Tasks", icon: Wrench },
] as const;

function isNavActive(pathname: string | null, href: string): boolean {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/inventory") {
        if (pathname === "/inventory") return true;
        if (!pathname.startsWith("/inventory/")) return false;
        // Sibling inventory routes have their own desktop nav items
        if (pathname.startsWith("/inventory/purchases")) return false;
        if (pathname.startsWith("/inventory/gallery")) return false;
        return true;
    }
    return pathname === href || pathname.startsWith(href + "/");
}

export function MobileBottomNav() {
    const pathname = usePathname();
    const [hideForPlatform, setHideForPlatform] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await apiFetch<{ data?: { is_platform_admin?: boolean } }>(
                    "/api/me",
                    { silent: true }
                );
                if (!cancelled && data?.data?.is_platform_admin) {
                    setHideForPlatform(true);
                }
            } catch {
                /* ignore — keep dealer nav */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Hide on vehicle intake wizard so sticky footer + steps have room
    const hideOnWizard =
        pathname === "/inventory/new" ||
        pathname === "/inventory/add" ||
        (pathname?.startsWith("/inventory/") && pathname?.endsWith("/edit"));
    if (hideOnWizard || hideForPlatform) return null;

    return (
        <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary">
            <ul className="grid grid-cols-5">
                {NAV.map(({ href, label, icon: Icon }) => {
                    const active = isNavActive(pathname, href);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                                    "min-h-[56px] cursor-pointer",
                                    active
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                                        active && "bg-primary-50 dark:bg-primary-50"
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span>{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
