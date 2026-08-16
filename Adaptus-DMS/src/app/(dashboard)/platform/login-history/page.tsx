"use client";

import { useState, useEffect } from "react";
import {
    Clock,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Monitor,
    Smartphone,
    Tablet,
    CheckCircle,
    XCircle,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import {
    DataTableShell,
    DataTableScroll,
    DataTable,
    DataTableHead,
    DataTableHeaderRow,
    DataTableTh,
    DataTableBody,
    DataTableRow,
    DataTableTd,
} from "@/src/components/ui/DataTable";

interface LoginHistory {
    id: string;
    user_id: string;
    email: string;
    login_at: string;
    ip_address: string;
    user_agent: string;
    device_type: string;
    success: boolean;
    failure_reason: string;
    dealership_id: string;
    created_at: string;
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function LoginHistoryPage() {
    const [logins, setLogins] = useState<LoginHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [limit] = useState(50);
    const [offset, setOffset] = useState(0);
    const [successFilter, setSuccessFilter] = useState<string>("");
    const [userFilter, setUserFilter] = useState("");

    useEffect(() => {
        void fetchLoginHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, limit]);

    async function fetchLoginHistory(overrides?: {
        userFilter?: string;
        successFilter?: string;
        offset?: number;
    }) {
        try {
            setLoading(true);
            setError(null);

            const meResponse = await fetch("/api/me", {});
            if (!meResponse.ok) throw new Error("Failed to get user info");
            const meData = await meResponse.json();
            if (!meData.data?.is_platform_admin) {
                setError("You do not have permission to access login history");
                return;
            }

            const activeUserFilter = overrides?.userFilter ?? userFilter;
            const activeSuccessFilter = overrides?.successFilter ?? successFilter;
            const activeOffset = overrides?.offset ?? offset;

            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: activeOffset.toString(),
            });
            if (activeSuccessFilter) params.set("success", activeSuccessFilter);

            const token = activeUserFilter.trim();
            if (token) {
                if (UUID_RE.test(token)) {
                    params.set("user_id", token);
                } else if (token.includes("@")) {
                    params.set("email", token);
                } else {
                    params.set("q", token);
                }
            }

            const response = await fetch(`/api/platform/login-history?${params}`, {});
            if (!response.ok) throw new Error("Failed to fetch login history");

            const data = await response.json();
            setLogins(data.data || []);
            setCount(data.count || 0);
        } catch (err: unknown) {
            console.error("Error fetching login history:", err);
            setError(err instanceof Error ? err.message : "Failed to load login history");
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setOffset(0);
        void fetchLoginHistory();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const getDeviceIcon = (deviceType: string) => {
        switch (deviceType) {
            case "Mobile":
                return <Smartphone className="h-4 w-4" />;
            case "Tablet":
                return <Tablet className="h-4 w-4" />;
            default:
                return <Monitor className="h-4 w-4" />;
        }
    };

    const successfulLogins = logins.filter((l) => l.success).length;
    const failedLogins = logins.filter((l) => !l.success).length;
    const hasFilters = Boolean(userFilter.trim() || successFilter);

    if (error && !loading && logins.length === 0 && error.includes("permission")) {
        return (
            <ListPageShell
                title="Login History"
                description="Track user login attempts across the platform"
                icon={Clock}
                breadcrumbs={[
                    { label: "AdaptUs Platform", href: "/dashboard" },
                    { label: "Login History" },
                ]}
            >
                <EmptyState kind="permission" title="Access denied" description={error} />
            </ListPageShell>
        );
    }

    return (
        <ListPageShell
            title="Login History"
            description="Track user login attempts across the platform"
            icon={Clock}
            breadcrumbs={[
                { label: "AdaptUs Platform", href: "/dashboard" },
                { label: "Login History" },
            ]}
            actions={
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchLoginHistory()}
                    disabled={loading}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            }
            kpis={
                <MetricStrip
                    loading={loading && logins.length === 0}
                    items={[
                        { label: "Total", value: count, format: "number" },
                        {
                            label: "Successful (page)",
                            value: successfulLogins,
                            format: "number",
                            tone: "success",
                        },
                        {
                            label: "Failed (page)",
                            value: failedLogins,
                            format: "number",
                            tone: "destructive",
                        },
                        { label: "Showing", value: logins.length, format: "number" },
                    ]}
                />
            }
            toolbar={
                <form
                    onSubmit={handleSearch}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                    <div className="relative max-w-md flex-1">
                        <input
                            type="search"
                            placeholder="Search by email or user UUID…"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                    <select
                        value={successFilter}
                        onChange={(e) => setSuccessFilter(e.target.value)}
                        className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Success filter"
                    >
                        <option value="">All attempts</option>
                        <option value="true">Successful</option>
                        <option value="false">Failed</option>
                    </select>
                    <Button type="submit" size="sm">
                        Filter
                    </Button>
                </form>
            }
        >
            {error && !error.includes("permission") ? (
                <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <SkeletonTable rows={8} cols={6} />
            ) : logins.length === 0 ? (
                <EmptyState
                    kind={hasFilters ? "no-results" : "first-use"}
                    icon={Clock}
                    title={hasFilters ? "No matching logins" : "No login history yet"}
                    description={
                        hasFilters
                            ? "Try a different email, UUID, or clear the success filter."
                            : "Login attempts will appear here once users sign in."
                    }
                    action={
                        hasFilters
                            ? {
                                  label: "Clear filters",
                                  onClick: () => {
                                      setUserFilter("");
                                      setSuccessFilter("");
                                      setOffset(0);
                                      void fetchLoginHistory({
                                          userFilter: "",
                                          successFilter: "",
                                          offset: 0,
                                      });
                                  },
                              }
                            : undefined
                    }
                />
            ) : (
                <>
                    <DataTableShell>
                        <DataTableScroll>
                            <DataTable>
                                <DataTableHead>
                                    <DataTableHeaderRow>
                                        <DataTableTh>Status</DataTableTh>
                                        <DataTableTh>User</DataTableTh>
                                        <DataTableTh>Device</DataTableTh>
                                        <DataTableTh>Date & time</DataTableTh>
                                        <DataTableTh>IP</DataTableTh>
                                        <DataTableTh>Failure reason</DataTableTh>
                                    </DataTableHeaderRow>
                                </DataTableHead>
                                <DataTableBody>
                                    {logins.map((login) => (
                                        <DataTableRow key={login.id}>
                                            <DataTableTd>
                                                {login.success ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                                        <CheckCircle className="h-3.5 w-3.5" />
                                                        Success
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Failed
                                                    </span>
                                                )}
                                            </DataTableTd>
                                            <DataTableTd>
                                                <p className="font-medium text-foreground">
                                                    {login.email || "—"}
                                                </p>
                                                {login.user_id ? (
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {login.user_id.slice(0, 8)}…
                                                    </p>
                                                ) : null}
                                            </DataTableTd>
                                            <DataTableTd>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    {getDeviceIcon(login.device_type)}
                                                    <span className="text-foreground">
                                                        {login.device_type || "—"}
                                                    </span>
                                                </div>
                                            </DataTableTd>
                                            <DataTableTd className="text-muted-foreground">
                                                {formatDate(login.login_at)}
                                            </DataTableTd>
                                            <DataTableTd>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {login.ip_address || "—"}
                                                </span>
                                            </DataTableTd>
                                            <DataTableTd>
                                                <span className="text-sm text-destructive">
                                                    {login.failure_reason || "—"}
                                                </span>
                                            </DataTableTd>
                                        </DataTableRow>
                                    ))}
                                </DataTableBody>
                            </DataTable>
                        </DataTableScroll>
                    </DataTableShell>

                    <div className="mt-3 flex items-center justify-between">
                        <p className="text-[13px] text-muted-foreground">
                            Showing {offset + 1} to {Math.min(offset + limit, count)} of {count}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setOffset(Math.max(0, offset - limit))}
                                disabled={offset === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setOffset(offset + limit)}
                                disabled={offset + limit >= count}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </ListPageShell>
    );
}
