"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, RefreshCw } from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { apiFetch } from "@/src/lib/fetch";
import { applicantFullName, type ScreeningSummary } from "@/src/lib/credit/credit-app";

type CreditApplicationRow = {
    id: string;
    status: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    employer: string | null;
    annual_income: number | null;
    requested_amount: number | null;
    partner_channel_configured: boolean;
    partner_submitted_at: string | null;
    created_at: string;
    customer: { id: string; name: string | null } | null;
    vehicle: { year: number; make: string; model: string } | null;
    screening_summary: ScreeningSummary | Record<string, unknown>;
};

const STATUS_BADGE: Record<string, string> = {
    draft: "bg-muted text-foreground",
    screening_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    decision_received: "bg-violet-50 text-violet-700 border-violet-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatCad(n: number | null): string {
    if (n === null || n === undefined) return "—";
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
    }).format(n);
}

export default function CreditApplicationsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<CreditApplicationRow[]>([]);
    const [count, setCount] = useState(0);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{
                data: CreditApplicationRow[];
                count: number;
            }>("/api/crm/credit-applications?limit=100", { silent: true });
            setRows(res.data || []);
            setCount(res.count || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load applications");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ListPageShell
            title="Credit Applications"
            description="Capture + prefill credit applications; partner-led screening — not a lender network"
            icon={CreditCard}
            breadcrumbs={[
                { label: "Finance", href: "/finance" },
                { label: "Credit Applications" },
            ]}
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        aria-label="Refresh applications"
                        onClick={() => void load()}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Link href="/finance/credit/new">
                        <Button size="sm">
                            <Plus className="h-4 w-4" />
                            New application
                        </Button>
                    </Link>
                </div>
            }
        >
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead className="border-b border-border bg-card/95 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                            <tr>
                                <th className="px-3.5 py-2.5">Applicant</th>
                                <th className="px-3.5 py-2.5">Status</th>
                                <th className="px-3.5 py-2.5">Income</th>
                                <th className="px-3.5 py-2.5">Requested</th>
                                <th className="px-3.5 py-2.5">Partner</th>
                                <th className="px-3.5 py-2.5">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-6">
                                        <SkeletonTable rows={6} cols={5} />
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="p-6">
                                        <EmptyState
                                            kind="error"
                                            title="Couldn't load applications"
                                            description={error}
                                            className="border-0 bg-transparent py-10"
                                        />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-6">
                                        <EmptyState
                                            kind="first-use"
                                            icon={CreditCard}
                                            title="No credit applications yet"
                                            description="Capture a new application to start a screening-ready summary."
                                            action={{
                                                label: "New application",
                                                onClick: () => {
                                                    router.push("/finance/credit/new");
                                                },
                                                icon: Plus,
                                            }}
                                            className="border-0 bg-transparent py-10"
                                        />
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            router.push(`/finance/credit/${row.id}`);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                router.push(`/finance/credit/${row.id}`);
                                            }
                                        }}
                                        className="cursor-pointer border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/50"
                                    >
                                        <td className="px-3.5 py-2.5">
                                            <p className="font-medium text-foreground">
                                                {applicantFullName(row) ||
                                                    row.customer?.name ||
                                                    "Unnamed"}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {row.email || "no email"}
                                            </p>
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            <span
                                                className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[row.status] || "bg-muted text-foreground"}`}
                                            >
                                                {row.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2.5 tabular-nums text-foreground/90">
                                            {formatCad(row.annual_income)}
                                        </td>
                                        <td className="px-3.5 py-2.5 tabular-nums text-foreground/90">
                                            {formatCad(row.requested_amount)}
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            {row.partner_submitted_at ? (
                                                <span className="text-[11px] font-medium text-blue-700">
                                                    Submitted
                                                </span>
                                            ) : row.partner_channel_configured ? (
                                                <span className="text-[11px] text-emerald-700">
                                                    Channel ready
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-amber-700">
                                                    No partner configured
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-muted-foreground">
                                            {new Date(row.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && !error && rows.length > 0 && (
                    <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                        {count} application{count === 1 ? "" : "s"}
                    </div>
                )}
            </div>
        </ListPageShell>
    );
}
