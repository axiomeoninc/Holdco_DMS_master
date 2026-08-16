"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    BarChart3,
    Users,
    TestTube,
    FileText,
    Receipt,
    Car,
    UserCog,
    Search,
    Settings,
    LogOut,
    ChevronDown,
    User,
    Shield,
    Menu,
    X,
    FlaskConical,
    ReceiptIcon,
    Loader2,
    Store,
    CreditCard,
    UserCheck,
    Key,
    Flag,
    LogIn,
    CalendarDays,
    Calculator,
    ShoppingCart,
    Share2,
    Building2,
    Plug,
    ListTodo,
    Globe,
    Wrench,
    Images,
    Landmark,
    Mail,
    MessageSquare,
    ShieldCheck,
    FileSpreadsheet,
    ScrollText,
    Archive,
    Star,
    PanelLeft,
    PanelLeftClose,
    type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Avatar } from "@/src/components/ui/Avatar";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Tooltip } from "@/src/components/ui/Tooltip";
import { openCommandPalette } from "@/src/components/help/desk-help";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { cn } from "@/src/lib/utils";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";
import {
    readDealershipCookieFromDocument,
    ROOFTOP_CHANGE_EVENT,
    writeDealershipCookie,
} from "@/src/lib/platform-rooftop";

interface UserData {
    full_name: string;
    email: string;
    role: string;
    phone: string;
    avatar: string | null;
    is_platform_admin: boolean;
    dealership_id: string | null;
    dealership_name?: string;
    user_permissions?: string[];
    effective_permissions?: string[];
}

interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    badge?: number;
}
interface NavSection {
    title: string;
    items: NavItem[];
}

const platformAdminSections: NavSection[] = [
    {
        title: "AdaptUs Platform",
        items: [
            { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { name: "All Dealerships", href: "/dealerships", icon: Store },
            { name: "All Users", href: "/users", icon: UserCog },
            { name: "Analytics", href: "/platform/analytics", icon: BarChart3 },
        ],
    },
    {
        title: "Operations",
        items: [
            { name: "Audit Logs", href: "/platform/audit-logs", icon: Shield },
            { name: "Login History", href: "/platform/login-history", icon: LogIn },
            { name: "Subscriptions", href: "/platform/subscriptions", icon: CreditCard },
        ],
    },
    {
        title: "Admin tools",
        items: [
            { name: "Impersonate User", href: "/platform/impersonate", icon: UserCheck },
            { name: "Reset Password", href: "/platform/reset-password", icon: Key },
            { name: "Feature Flags", href: "/platform/feature-flags", icon: Flag },
            { name: "Platform Settings", href: "/settings/platform", icon: Settings },
        ],
    },
];

interface PermNavItem extends NavItem {
    /** If set, show when Admin/Manager or any listed permission matches. */
    anyOf?: string[];
    /** If set, only these dealership roles may see the item (platform admin always). */
    roles?: string[];
}

interface PermNavSection {
    title: string;
    items: PermNavItem[];
}

/** Master Guide nav IA + Wave A off-nav modules */
const dealershipSections: PermNavSection[] = [
    {
        title: "Overview",
        items: [
            { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { name: "Calendar", href: "/calendar", icon: CalendarDays },
        ],
    },
    {
        title: "Sales",
        items: [
            { name: "Lead Center", href: "/leads", icon: Users },
            { name: "Test Drives", href: "/test-drives", icon: TestTube },
            { name: "Deals", href: "/deals", icon: FileText },
            { name: "Follow-ups", href: "/follow-ups", icon: Receipt },
            { name: "Email sequences", href: "/email-sequences", icon: Mail },
            { name: "SMS sequences", href: "/sms-sequences", icon: MessageSquare },
            { name: "Quotations", href: "/quotations", icon: Calculator },
            {
                name: "Finance calculator",
                href: "/finance",
                icon: Landmark,
                anyOf: ["tools:read", "tools:write", "ai:finance_calculator", "deals:read", "deals:write"],
            },
        ],
    },
    {
        title: "Inventory",
        items: [
            { name: "All Vehicles", href: "/inventory", icon: Car },
            {
                name: "Gallery",
                href: "/inventory/gallery",
                icon: Images,
                anyOf: ["vehicles:read", "vehicles:write", "vehicles:photos"],
            },
            { name: "Purchase from Public", href: "/inventory/purchases", icon: ShoppingCart },
        ],
    },
    {
        title: "Customers",
        items: [{ name: "Directory", href: "/customers", icon: Users }],
    },
    {
        title: "Financial",
        items: [
            { name: "Invoices", href: "/invoices", icon: Receipt },
            { name: "Credit Applications", href: "/finance/credit", icon: CreditCard },
            { name: "Expenses", href: "/expenses", icon: ReceiptIcon },
            {
                name: "Vendors",
                href: "/vendors",
                icon: Store,
                anyOf: ["vendors:read", "vendors:write"],
            },
            { name: "Reports", href: "/reports", icon: BarChart3 },
        ],
    },
    {
        title: "Marketing",
        items: [{ name: "Social Posting", href: "/social", icon: Share2 }],
    },
    {
        title: "Management",
        items: [
            { name: "Tasks", href: "/tasks", icon: ListTodo },
            { name: "Tickets", href: "/tickets", icon: FlaskConical },
            { name: "Service", href: "/service", icon: Wrench, anyOf: ["service:read", "service:write", "customers:read", "vehicles:read"] },
            {
                name: "Users",
                href: "/users",
                icon: UserCog,
                // API is Admin-only; Managers must not see a dead Users link
                roles: ["Admin"],
                anyOf: ["users:read", "users:write", "users:assign_roles"],
            },
            {
                name: "Roles",
                href: "/roles",
                icon: Shield,
                anyOf: ["users:write", "users:assign_roles", "roles:read", "roles:write"],
            },
            {
                name: "Tools",
                href: "/tools",
                icon: Wrench,
                anyOf: ["tools:read", "tools:write"],
            },
        ],
    },
    {
        title: "Settings",
        items: [
            { name: "Profile", href: "/profile", icon: User },
            {
                name: "Business",
                href: "/settings/business",
                icon: Building2,
                anyOf: ["settings:read", "settings:write", "settings:company", "settings:taxes"],
            },
            { name: "Website embed", href: "/settings/website", icon: Globe, anyOf: ["settings:read", "settings:write", "settings:company"] },
            {
                name: "AI Governance",
                href: "/settings/ai-governance",
                icon: ShieldCheck,
                anyOf: ["settings:read", "settings:write"],
            },
            {
                name: "Integrations",
                href: "/settings/integrations",
                icon: Plug,
                anyOf: ["settings:read", "settings:write", "settings:integrations"],
            },
            {
                name: "Subscription",
                href: "/settings/subscription",
                icon: CreditCard,
                anyOf: ["settings:read", "settings:write", "settings:company"],
            },
            {
                name: "Billing",
                href: "/settings/billing",
                icon: CreditCard,
                anyOf: ["settings:read", "settings:write", "settings:company"],
            },
            {
                name: "Accounting Export",
                href: "/settings/accounting",
                icon: FileSpreadsheet,
                anyOf: ["settings:read", "settings:write", "settings:company"],
            },
            {
                name: "Audit Trail",
                href: "/settings/audit",
                icon: ScrollText,
                anyOf: ["settings:read", "settings:write"],
            },
            {
                name: "Retention & Compliance",
                href: "/settings/retention",
                icon: Archive,
                anyOf: ["settings:read", "settings:write"],
            },
            {
                name: "Locations",
                href: "/settings/locations",
                icon: Building2,
                anyOf: ["settings:read", "settings:write", "settings:company"],
            },
            {
                name: "Reviews",
                href: "/settings/reviews",
                icon: Star,
                anyOf: ["settings:read", "settings:write", "settings:company"],
            },
        ],
    },
];

const ALL_SECTION_TITLES = dealershipSections.map((s) => s.title);
const DEFAULT_EXPANDED = ALL_SECTION_TITLES.filter((title) => title !== "Settings");
const RAIL_STORAGE_KEY = "ff-sidebar-collapsed";

function isItemActive(pathname: string, href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/inventory") {
        if (pathname === "/inventory") return true;
        if (!pathname.startsWith("/inventory/")) return false;
        // Sibling inventory routes have their own nav items
        if (pathname.startsWith("/inventory/purchases")) return false;
        if (pathname.startsWith("/inventory/gallery")) return false;
        return true;
    }
    if (href === "/users") {
        return pathname === "/users" || pathname.startsWith("/users/");
    }
    return pathname === href || pathname.startsWith(href + "/");
}

function canSeeNavItem(
    item: PermNavItem,
    opts: { role: string; isPlatformAdmin: boolean; permissions: string[] }
): boolean {
    if (opts.isPlatformAdmin) return true;
    if (item.roles && item.roles.length > 0 && !item.roles.includes(opts.role)) {
        return false;
    }
    if (!item.anyOf || item.anyOf.length === 0) return true;
    if (opts.role === "Admin" || opts.role === "Manager") return true;
    if (opts.permissions.includes("*")) return true;
    return item.anyOf.some((p) => opts.permissions.includes(p));
}

export default function Sidebar() {
    const pathname = usePathname() ?? "";
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<string[]>(DEFAULT_EXPANDED);
    const [railCollapsed, setRailCollapsed] = useState(false);
    const [unseenLeads, setUnseenLeads] = useState(0);
    const [rooftopId, setRooftopId] = useState<string | null>(null);
    const [rooftopName, setRooftopName] = useState<string | null>(null);

    useOverlayDismiss(() => setIsMobileOpen(false), { open: isMobileOpen });

    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        try {
            setRailCollapsed(localStorage.getItem(RAIL_STORAGE_KEY) === "1");
        } catch {
            /* ignore */
        }
    }, []);

    const toggleRail = () => {
        setRailCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0");
            } catch {
                /* ignore */
            }
            return next;
        });
    };

    useEffect(() => {
        if (isMobileOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [isMobileOpen]);

    useEffect(() => {
        async function fetchUserData() {
            try {
                const data = await apiFetch<{ data: UserData }>("/api/me", { silent: true });
                if (data?.data) setUserData(data.data);
            } catch (err) {
                console.error("Failed to fetch user data:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchUserData();
    }, []);

    useEffect(() => {
        const sync = () => setRooftopId(readDealershipCookieFromDocument());
        sync();
        window.addEventListener(ROOFTOP_CHANGE_EVENT, sync);
        return () => window.removeEventListener(ROOFTOP_CHANGE_EVENT, sync);
    }, []);

    useEffect(() => {
        if (!userData?.is_platform_admin || !rooftopId) {
            setRooftopName(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch<{
                    data?: Array<{ id: string; name: string }>;
                }>("/api/dealerships?limit=100", { silent: true });
                if (cancelled) return;
                const match = res.data?.find((d) => d.id === rooftopId);
                setRooftopName(match?.name ?? null);
            } catch {
                if (!cancelled) setRooftopName(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userData?.is_platform_admin, rooftopId]);

    // Lead Center unseen badge (best-effort; ignore failures)
    useEffect(() => {
        if (userData?.is_platform_admin && !rooftopId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch<{ count?: number; data?: unknown[] }>(
                    "/api/leads?status=new&limit=1",
                    { silent: true }
                );
                if (!cancelled) setUnseenLeads(typeof res.count === "number" ? res.count : 0);
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userData?.is_platform_admin, rooftopId]);

    const sections = useMemo(() => {
        if (userData?.is_platform_admin) {
            if (!rooftopId) return platformAdminSections;

            const permissions =
                userData.effective_permissions?.length
                    ? userData.effective_permissions
                    : userData.user_permissions || [];
            const dealer = dealershipSections
                .map((section) => ({
                    title: section.title,
                    items: section.items.filter((item) =>
                        canSeeNavItem(item, {
                            role: userData.role || "",
                            isPlatformAdmin: true,
                            permissions,
                        })
                    ),
                }))
                .filter((section) => section.items.length > 0);

            const existing = new Set(
                platformAdminSections.flatMap((section) =>
                    section.items.map((item) => item.href)
                )
            );
            const extra = dealer
                .map((section) => ({
                    ...section,
                    items: section.items.filter((item) => !existing.has(item.href)),
                }))
                .filter((section) => section.items.length > 0);

            const withLeads =
                unseenLeads <= 0
                    ? extra
                    : extra.map((section) => {
                          if (section.title !== "Sales") return section;
                          return {
                              ...section,
                              items: section.items.map((item) =>
                                  item.href === "/leads"
                                      ? { ...item, badge: unseenLeads }
                                      : item
                              ),
                          };
                      });

            return [...platformAdminSections, ...withLeads];
        }

        const permissions =
            userData?.effective_permissions?.length
                ? userData.effective_permissions
                : userData?.user_permissions || [];
        const role = userData?.role || "";

        const base: NavSection[] = dealershipSections
            .map((section) => ({
                title: section.title,
                items: section.items.filter((item) =>
                    canSeeNavItem(item, {
                        role,
                        isPlatformAdmin: false,
                        permissions,
                    })
                ),
            }))
            .filter((section) => section.items.length > 0);

        if (unseenLeads <= 0) return base;
        return base.map((section) => {
            if (section.title !== "Sales") return section;
            return {
                ...section,
                items: section.items.map((item) =>
                    item.href === "/leads" ? { ...item, badge: unseenLeads } : item
                ),
            };
        });
    }, [userData, unseenLeads, rooftopId]);

    useEffect(() => {
        setExpandedSections((prev) => {
            let changed = false;
            const next = [...prev];
            for (const section of sections) {
                if (section.title === "Settings") continue;
                if (!next.includes(section.title)) {
                    next.push(section.title);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [sections]);

    useEffect(() => {
        setExpandedSections((prev) => {
            const active = sections.find((section) =>
                section.items.some((item) => isItemActive(pathname, item.href))
            );
            if (!active || prev.includes(active.title)) return prev;
            return [...prev, active.title];
        });
    }, [pathname, sections]);

    const toggleSection = (title: string) => {
        setExpandedSections((prev) =>
            prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
        );
    };

    async function handleLogout() {
        if (logoutLoading) return;
        setLogoutLoading(true);
        try {
            await apiFetch("/api/auth/logout", { method: "POST" });
            writeDealershipCookie(null);
            toast.success("Signed out", "You have been logged out.");
            router.push("/login");
            router.refresh();
        } catch (err) {
            toast.error("Could not sign out", err instanceof Error ? err.message : "Please try again.");
            setLogoutLoading(false);
        }
    }

    const renderNav = (collapsed: boolean) => (
        <nav className="flex h-full flex-col" aria-label="Main">
            <div
                className={cn(
                    "flex h-14 items-center border-b border-border",
                    collapsed ? "justify-center px-1.5" : "gap-2.5 px-3.5"
                )}
            >
                <div className={cn("min-w-0", collapsed ? "flex justify-center" : "flex-1")}>
                    <BrandLogo
                        variant={collapsed ? "mark" : "lockup"}
                        size="sm"
                        href="/dashboard"
                        subtitle={
                            collapsed
                                ? null
                                : userData?.is_platform_admin
                                  ? rooftopName
                                      ? `Acting as ${rooftopName}`
                                      : "AdaptUs Platform"
                                  : userData?.dealership_name ?? null
                        }
                    />
                </div>
                {!collapsed && (
                    <button
                        type="button"
                        onClick={() => setIsMobileOpen(false)}
                        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                        aria-label="Close menu"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-1.5" : "px-2")}>
                {collapsed
                    ? sections.flatMap((section) =>
                          section.items.map((item) => {
                              const Icon = item.icon;
                              const active = isItemActive(pathname, item.href);
                              return (
                                  <Tooltip
                                      key={item.href}
                                      content={item.name}
                                      side="right"
                                      wrapperClassName="mb-px block w-full min-w-0"
                                  >
                                  <Link
                                      href={item.href}
                                      aria-label={item.name}
                                      className={cn(
                                          "relative mb-px flex h-9 w-full items-center justify-center rounded-md transition-colors duration-150",
                                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                          active
                                              ? "bg-muted/80 text-foreground"
                                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                      )}
                                      aria-current={active ? "page" : undefined}
                                  >
                                      {active && (
                                          <span
                                              className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                                              aria-hidden
                                          />
                                      )}
                                      <Icon
                                          className={cn(
                                              "h-4 w-4",
                                              active ? "text-primary" : "text-muted-foreground"
                                          )}
                                      />
                                      {item.badge != null && item.badge > 0 && (
                                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                      )}
                                  </Link>
                                  </Tooltip>
                              );
                          })
                      )
                    : sections.map((section) => {
                          const isExpanded = expandedSections.includes(section.title);
                          return (
                              <div key={section.title} className="mb-1">
                                  <button
                                      type="button"
                                      onClick={() => toggleSection(section.title)}
                                      className="flex w-full items-center justify-between rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60 transition-colors duration-150 hover:text-muted-foreground"
                                      aria-expanded={isExpanded}
                                  >
                                      <span className="min-w-0 truncate">{section.title}</span>
                                      <ChevronDown
                                          className={cn(
                                              "h-3 w-3 transition-transform duration-150",
                                              !isExpanded && "-rotate-90"
                                          )}
                                      />
                                  </button>
                                  {isExpanded && (
                                      <ul className="mt-0.5 space-y-px">
                                          {section.items.map((item) => {
                                              const Icon = item.icon;
                                              const active = isItemActive(pathname, item.href);
                                              return (
                                                  <li key={item.href}>
                                                      <Link
                                                          href={item.href}
                                                          className={cn(
                                                              "group relative flex min-h-8 min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                                                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                                              active
                                                                  ? "bg-muted/80 text-foreground"
                                                                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
                                                          )}
                                                          aria-current={active ? "page" : undefined}
                                                      >
                                                          {active && (
                                                              <span
                                                                  className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                                                                  aria-hidden
                                                              />
                                                          )}
                                                          <Icon
                                                              className={cn(
                                                                  "h-3.5 w-3.5 shrink-0",
                                                                  active
                                                                      ? "text-primary"
                                                                      : "text-muted-foreground group-hover:text-foreground"
                                                              )}
                                                          />
                                                          <span className="truncate flex-1">{item.name}</span>
                                                          {item.badge != null && item.badge > 0 && (
                                                              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                                                  {item.badge > 99 ? "99+" : item.badge}
                                                              </span>
                                                          )}
                                                      </Link>
                                                  </li>
                                              );
                                          })}
                                      </ul>
                                  )}
                              </div>
                          );
                      })}
            </div>

            <div
                className={cn(
                    "space-y-1.5 border-t border-border bg-muted/30",
                    collapsed ? "p-1.5" : "p-2.5"
                )}
            >
                <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
                <button
                    type="button"
                    onClick={toggleRail}
                    className="hidden h-8 w-full items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground lg:flex"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-pressed={collapsed}
                >
                    {collapsed ? (
                        <PanelLeft className="h-4 w-4" />
                    ) : (
                        <span className="flex w-full items-center gap-2 px-1.5 text-[12px] font-medium">
                            <PanelLeftClose className="h-3.5 w-3.5" />
                            Collapse
                        </span>
                    )}
                </button>
                </Tooltip>

                {loading ? (
                    <div
                        className={cn(
                            "flex items-center rounded-md p-1.5",
                            collapsed ? "justify-center" : "gap-2.5"
                        )}
                    >
                        <div className="h-8 w-8 animate-shimmer rounded-full bg-muted" />
                        {!collapsed && (
                            <div className="flex-1 space-y-1.5">
                                <div className="h-2.5 w-20 animate-shimmer rounded bg-muted" />
                                <div className="h-2 w-28 animate-shimmer rounded bg-muted" />
                            </div>
                        )}
                    </div>
                ) : userData ? (
                    <Link
                        href="/profile"
                        title={userData.full_name || userData.email}
                        className={cn(
                            "flex min-w-0 items-center rounded-md p-1.5 transition-colors duration-150 hover:bg-muted",
                            collapsed ? "justify-center" : "gap-2.5"
                        )}
                    >
                        <Avatar
                            src={userData.avatar}
                            name={userData.full_name}
                            email={userData.email}
                            size="md"
                        />
                        {!collapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-foreground">
                                    {userData.full_name || userData.email}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {userData.role}
                                </p>
                            </div>
                        )}
                    </Link>
                ) : (
                    <Link
                        href="/login"
                        title="Sign in"
                        className={cn(
                            "flex items-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                            collapsed ? "justify-center" : "gap-2.5"
                        )}
                    >
                        <User className="h-4 w-4" />
                        {!collapsed && <span className="text-[13px]">Sign in</span>}
                    </Link>
                )}

                <div className={cn("flex items-center gap-1.5 lg:hidden", collapsed && "hidden")}>
                    <ThemeToggle />
                    {userData && (
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={logoutLoading}
                            className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                            aria-label="Sign out"
                        >
                            {logoutLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <LogOut className="h-3.5 w-3.5" />
                            )}
                            <span>Sign out</span>
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );

    return (
        <>
            <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2.5 border-b border-border bg-card px-3 shadow-sm safe-top lg:hidden">
                <button
                    type="button"
                    onClick={() => setIsMobileOpen(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
                    aria-label="Open menu"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                    <BrandLogo
                        variant="lockup"
                        size="sm"
                        href="/dashboard"
                        subtitle={
                            userData?.is_platform_admin
                                ? rooftopName
                                    ? `Acting as ${rooftopName}`
                                    : "AdaptUs Platform"
                                : userData?.dealership_name ?? null
                        }
                    />
                </div>
                <button
                    type="button"
                    onClick={() => openCommandPalette()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Search desk"
                >
                    <Search className="h-5 w-5" />
                </button>
            </div>

            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-50 lg:hidden"
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="absolute inset-0 animate-fade-in bg-foreground/40"
                        onClick={() => setIsMobileOpen(false)}
                        aria-hidden
                    />
                    <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] animate-fade-in bg-card shadow-lg">
                        {renderNav(false)}
                    </aside>
                </div>
            )}

            <aside
                className={cn(
                    "hidden shrink-0 border-r border-border bg-card transition-[width] duration-200 lg:block",
                    railCollapsed ? "w-14" : "w-64"
                )}
                aria-label="Main"
            >
                {renderNav(railCollapsed)}
            </aside>
        </>
    );
}
