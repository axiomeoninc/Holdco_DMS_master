"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowRight,
    BarChart3,
    Building2,
    Clock,
    CreditCard,
    Flag,
    Key,
    Settings,
    Shield,
    UserCheck,
    Users,
    type LucideIcon,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Skeleton } from "@/src/components/ui/Skeleton";

type HubLink = {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
};

const PLATFORM_TOOLS: HubLink[] = [
    {
        href: "/platform/analytics",
        title: "Analytics",
        description: "Platform metrics, revenue, and dealership performance",
        icon: BarChart3,
    },
    {
        href: "/platform/impersonate",
        title: "Impersonate",
        description: "View the product as another user for support",
        icon: UserCheck,
    },
    {
        href: "/platform/audit-logs",
        title: "Audit Logs",
        description: "Review platform and dealership activity history",
        icon: Shield,
    },
    {
        href: "/platform/login-history",
        title: "Login History",
        description: "Track login attempts across all dealerships",
        icon: Clock,
    },
    {
        href: "/platform/subscriptions",
        title: "Subscriptions",
        description: "Manage plans, billing cycles, and tenant status",
        icon: CreditCard,
    },
    {
        href: "/platform/feature-flags",
        title: "Feature Flags",
        description: "Toggle platform features for tenants",
        icon: Flag,
    },
    {
        href: "/platform/reset-password",
        title: "Reset Password",
        description: "Force password resets for dealership users",
        icon: Key,
    },
];

const ADMIN_SHORTCUTS: HubLink[] = [
    {
        href: "/dealerships",
        title: "Dealerships",
        description: "Create and manage tenant dealerships",
        icon: Building2,
    },
    {
        href: "/users",
        title: "Users",
        description: "Browse and manage users across dealerships",
        icon: Users,
    },
    {
        href: "/settings/platform",
        title: "Platform Settings",
        description: "Global platform configuration and overview",
        icon: Settings,
    },
];

function HubCard({ href, title, description, icon: Icon }: HubLink) {
    return (
        <Link
            href={href}
            className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#00AEEF]/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
        >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#00AEEF]/30 bg-[#00AEEF]/10 text-[#00AEEF] transition-colors group-hover:bg-[#00AEEF]/15">
                <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-base font-semibold text-foreground group-hover:text-[#00AEEF]">
                {title}
            </h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#00AEEF]">
                Open
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Link>
    );
}

export default function PlatformHubPage() {
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const meResponse = await fetch("/api/me", { credentials: "same-origin" });
                if (!meResponse.ok) {
                    if (!cancelled) setForbidden(true);
                    return;
                }
                const meData = (await meResponse.json()) as {
                    data?: { is_platform_admin?: boolean };
                };
                if (!meData.data?.is_platform_admin) {
                    if (!cancelled) setForbidden(true);
                    return;
                }
            } catch {
                if (!cancelled) setForbidden(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <ListPageShell
                title="Platform Admin"
                description="FlashFender platform tools and tenant administration"
                icon={Shield}
                breadcrumbs={[{ label: "Platform" }]}
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-lg" />
                    ))}
                </div>
            </ListPageShell>
        );
    }

    if (forbidden) {
        return (
            <ListPageShell
                title="Platform Admin"
                description="FlashFender platform tools and tenant administration"
                icon={Shield}
                breadcrumbs={[{ label: "Platform" }]}
            >
                <EmptyState
                    kind="permission"
                    title="Platform admin required"
                    description="You do not have permission to access the platform admin hub."
                />
            </ListPageShell>
        );
    }

    return (
        <ListPageShell
            title="Platform Admin"
            description="FlashFender platform tools and tenant administration"
            icon={Shield}
            breadcrumbs={[{ label: "Platform" }]}
        >
            <section aria-labelledby="platform-tools-heading" className="space-y-3">
                <h2
                    id="platform-tools-heading"
                    className="text-sm font-medium text-muted-foreground"
                >
                    Platform tools
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {PLATFORM_TOOLS.map((tool) => (
                        <HubCard key={tool.href} {...tool} />
                    ))}
                </div>
            </section>

            <section aria-labelledby="admin-shortcuts-heading" className="space-y-3 pt-2">
                <h2
                    id="admin-shortcuts-heading"
                    className="text-sm font-medium text-muted-foreground"
                >
                    Administration
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ADMIN_SHORTCUTS.map((tool) => (
                        <HubCard key={tool.href} {...tool} />
                    ))}
                </div>
            </section>
        </ListPageShell>
    );
}
