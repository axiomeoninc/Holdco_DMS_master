"use client";

// Command palette (⌘K / Ctrl+K) — cmdk search over vehicles, customers, deals, leads + platform admin routes.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    BarChart3,
    Building2,
    CalendarDays,
    Car,
    CircleHelp,
    FileText,
    Flag,
    History,
    Loader2,
    Plus,
    Shield,
    Sparkles,
    UserCog,
    Users,
    UserRound,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/src/components/ui/command";
import { useFlashAi } from "@/src/components/ai/FlashAiProvider";
import { useDeskHelp } from "@/src/components/help/DeskHelpProvider";
import type { DeskHelpTopicId } from "@/src/components/help/desk-help";

type ResultKind = "vehicle" | "customer" | "deal" | "lead";

interface SearchResult {
    id: string;
    kind: ResultKind;
    title: string;
    subtitle: string;
    href: string;
}

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const KIND_META: Record<ResultKind, { label: string; icon: typeof Car }> = {
    vehicle: { label: "Vehicles", icon: Car },
    customer: { label: "Customers", icon: UserRound },
    deal: { label: "Deals", icon: FileText },
    lead: { label: "Leads", icon: Users },
};

const PLATFORM_ROUTES = [
    {
        href: "/platform/impersonate",
        title: "Impersonate",
        subtitle: "Sign in as a dealership user",
        icon: UserCog,
    },
    {
        href: "/platform/analytics",
        title: "Analytics",
        subtitle: "Platform metrics",
        icon: BarChart3,
    },
    {
        href: "/platform/audit-logs",
        title: "Audit Logs",
        subtitle: "Platform audit trail",
        icon: History,
    },
    {
        href: "/platform/feature-flags",
        title: "Feature Flags",
        subtitle: "Runtime toggles",
        icon: Flag,
    },
    {
        href: "/users",
        title: "Users",
        subtitle: "All platform users",
        icon: Users,
    },
    {
        href: "/dealerships",
        title: "Dealerships",
        subtitle: "Manage tenants",
        icon: Building2,
    },
] as const;

const DESK_ACTIONS = [
    {
        href: "/inventory/new",
        title: "New vehicle",
        subtitle: "Start intake",
        icon: Plus,
    },
    {
        href: "/customers",
        title: "New customer",
        subtitle: "Open the directory",
        icon: UserRound,
    },
    {
        href: "/deals/new",
        title: "New deal",
        subtitle: "Open the deals desk",
        icon: FileText,
    },
    {
        href: "/follow-ups",
        title: "Today’s follow-ups",
        subtitle: "Who to call next",
        icon: CalendarDays,
    },
] as const;

const HELP_ACTIONS: Array<{
    id: DeskHelpTopicId;
    title: string;
    subtitle: string;
}> = [
    { id: "quotation", title: "What’s a quotation?", subtitle: "Offer vs a won deal" },
    { id: "bos", title: "What’s a bill of sale?", subtitle: "Ontario transfer document" },
    { id: "casl", title: "CASL consent", subtitle: "Marketing email and SMS" },
    { id: "mvda", title: "MVDA known damage", subtitle: "Disclosure before Active" },
    { id: "desking", title: "What’s desking?", subtitle: "Monthly payment estimate" },
    { id: "palette", title: "How do I search?", subtitle: "⌘K / Ctrl+K" },
];

function vehicleLabel(v: Record<string, unknown>): string {
    const year = v.year ?? "";
    const make = v.make ?? "";
    const model = v.model ?? "";
    const stock = v.stock_number ?? v.stockNumber;
    const parts = [year, make, model].filter(Boolean).join(" ");
    return stock ? `${parts} · ${String(stock)}` : parts || "Vehicle";
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const router = useRouter();
    const { openPanel } = useFlashAi();
    const { openTopic } = useDeskHelp();
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

    const close = useCallback(() => {
        onOpenChange(false);
        setQuery("");
        setResults([]);
    }, [onOpenChange]);

    const askFlash = useCallback(() => {
        const seed = query.trim().length >= 2 ? query.trim() : undefined;
        close();
        openPanel(seed);
    }, [close, openPanel, query]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        void (async () => {
            try {
                const me = await apiFetch<{ data?: { is_platform_admin?: boolean } }>(
                    "/api/me",
                    { silent: true }
                );
                if (!cancelled) {
                    setIsPlatformAdmin(me.data?.is_platform_admin === true);
                }
            } catch {
                if (!cancelled) setIsPlatformAdmin(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (q.length < 2) {
            // Defer clearing results until after commit.
            const t = setTimeout(() => {
                setResults([]);
                setLoading(false);
            }, 0);
            return () => clearTimeout(t);
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const enc = encodeURIComponent(q);
                const [vehicles, customers, deals, leads] = await Promise.all([
                    apiFetch<{ data: Record<string, unknown>[] }>(
                        `/api/vehicles?q=${enc}&limit=5`,
                        { silent: true }
                    ).catch(() => ({ data: [] })),
                    apiFetch<{ data: Record<string, unknown>[] }>(
                        `/api/customers?q=${enc}&limit=5`,
                        { silent: true }
                    ).catch(() => ({ data: [] })),
                    apiFetch<{ data: Record<string, unknown>[] }>(
                        `/api/deals?q=${enc}&limit=5`,
                        { silent: true }
                    ).catch(() => ({ data: [] })),
                    apiFetch<{ data: Record<string, unknown>[] }>(
                        `/api/leads?q=${enc}&limit=5`,
                        { silent: true }
                    ).catch(() => ({ data: [] })),
                ]);

                if (cancelled) return;

                const next: SearchResult[] = [];

                for (const v of vehicles.data ?? []) {
                    const id = String(v.id);
                    next.push({
                        id,
                        kind: "vehicle",
                        title: vehicleLabel(v),
                        subtitle: String(v.vin ?? v.status ?? "Inventory"),
                        href: `/inventory/${v.vin ?? id}`,
                    });
                }
                for (const c of customers.data ?? []) {
                    const id = String(c.id);
                    const name =
                        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        String(c.full_name ?? c.email ?? "Customer");
                    next.push({
                        id,
                        kind: "customer",
                        title: name,
                        subtitle: String(c.email ?? c.phone ?? "Customer"),
                        href: `/customers/${id}`,
                    });
                }
                for (const d of deals.data ?? []) {
                    const id = String(d.id);
                    next.push({
                        id,
                        kind: "deal",
                        title: String(d.deal_number ?? d.title ?? `Deal ${id.slice(0, 8)}`),
                        subtitle: String(d.deal_status ?? d.status ?? "Deal"),
                        href: `/deals?id=${id}`,
                    });
                }
                for (const l of leads.data ?? []) {
                    const id = String(l.id);
                    const name =
                        [l.first_name, l.last_name].filter(Boolean).join(" ") ||
                        String(l.name ?? l.email ?? "Lead");
                    next.push({
                        id,
                        kind: "lead",
                        title: name,
                        subtitle: String(l.status ?? l.source ?? "Lead"),
                        href: `/leads?id=${id}`,
                    });
                }

                setResults(next);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 220);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [open, query]);

    const select = useCallback(
        (href: string) => {
            close();
            router.push(href);
        },
        [close, router]
    );

    if (!open) return null;

    const order: ResultKind[] = ["vehicle", "customer", "deal", "lead"];
    const grouped = order
        .map((kind) => ({
            kind,
            items: results.filter((r) => r.kind === kind),
        }))
        .filter((g) => g.items.length > 0);

    const qLower = query.trim().toLowerCase();
    const platformItems = isPlatformAdmin
        ? PLATFORM_ROUTES.filter(
              (r) =>
                  !qLower ||
                  r.title.toLowerCase().includes(qLower) ||
                  r.subtitle.toLowerCase().includes(qLower) ||
                  r.href.toLowerCase().includes(qLower)
          )
        : [];

    const actionItems = DESK_ACTIONS.filter(
        (r) =>
            !qLower ||
            r.title.toLowerCase().includes(qLower) ||
            r.subtitle.toLowerCase().includes(qLower)
    );

    const helpItems = HELP_ACTIONS.filter(
        (r) =>
            !qLower ||
            r.title.toLowerCase().includes(qLower) ||
            r.subtitle.toLowerCase().includes(qLower) ||
            r.id.toLowerCase().includes(qLower)
    );

    return (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Command palette">
            <button
                type="button"
                className="absolute inset-0 bg-foreground/40 animate-fade-in"
                onClick={close}
                aria-label="Close command palette"
            />
            <div className="absolute left-1/2 top-[12vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 animate-fade-in-down overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                <Command shouldFilter={false} loop>
                    <div className="relative">
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search, jump, or ask what something means…"
                        />
                        {loading ? (
                            <Loader2 className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                            <kbd className="pointer-events-none absolute right-3 top-3.5 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                                ESC
                            </kbd>
                        )}
                    </div>
                    <CommandList>
                        <CommandGroup heading="Flash AI">
                            <CommandItem
                                value="ask-flash-ai"
                                onSelect={() => askFlash()}
                            >
                                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        Ask Flash AI
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        Desk copilot · drafts never auto-send
                                    </span>
                                </span>
                            </CommandItem>
                        </CommandGroup>
                        {actionItems.length > 0 ? (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading="Actions">
                                    {actionItems.map((route) => {
                                        const Icon = route.icon;
                                        return (
                                            <CommandItem
                                                key={route.href}
                                                value={`action-${route.title}`}
                                                onSelect={() => select(route.href)}
                                            >
                                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">
                                                        {route.title}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {route.subtitle}
                                                    </span>
                                                </span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </>
                        ) : null}
                        {helpItems.length > 0 ? (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading="What’s this?">
                                    {helpItems.map((item) => (
                                        <CommandItem
                                            key={item.id}
                                            value={`help-${item.title}`}
                                            onSelect={() => {
                                                close();
                                                openTopic(item.id);
                                            }}
                                        >
                                            <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {item.title}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {item.subtitle}
                                                </span>
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        ) : null}
                        <CommandSeparator />
                        {platformItems.length > 0 ? (
                            <>
                                <CommandGroup heading="Platform admin">
                                    {platformItems.map((route) => {
                                        const Icon = route.icon;
                                        return (
                                            <CommandItem
                                                key={route.href}
                                                value={`platform-${route.href}`}
                                                onSelect={() => select(route.href)}
                                            >
                                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">
                                                        {route.title}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {route.subtitle}
                                                    </span>
                                                </span>
                                                <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        ) : null}
                        {query.trim().length < 2 ? (
                            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                                Type at least 2 characters to search records.
                            </p>
                        ) : null}
                        {query.trim().length >= 2 && !loading && grouped.length === 0 ? (
                            <CommandEmpty>No results for “{query.trim()}”.</CommandEmpty>
                        ) : null}
                        {grouped.map((group) => {
                            const Meta = KIND_META[group.kind];
                            const Icon = Meta.icon;
                            return (
                                <CommandGroup key={group.kind} heading={Meta.label}>
                                    {group.items.map((item) => (
                                        <CommandItem
                                            key={`${item.kind}-${item.id}`}
                                            value={`${item.kind}-${item.id}-${item.title}`}
                                            onSelect={() => select(item.href)}
                                        >
                                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {item.title}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {item.subtitle}
                                                </span>
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            );
                        })}
                    </CommandList>
                </Command>
            </div>
        </div>
    );
}
