"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Star,
    Loader2,
    RefreshCw,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

type ReviewConfig = {
    enabled: boolean;
    auto_send: boolean;
    days_after_deal: number;
    google_review_url: string | null;
    review_note: string | null;
};

type SettingsData = {
    config: ReviewConfig;
    configured: boolean;
    resend_configured: boolean;
    dealership_name: string;
    can_edit: boolean;
    note: string;
};

type ReviewRequestRow = {
    id: string;
    status: string;
    consent_ok: boolean;
    created_at: string;
    sent_at: string | null;
    review_url: string | null;
    customer?: { id: string; name: string; email: string | null } | null;
};

const DEFAULT_CONFIG: ReviewConfig = {
    enabled: false,
    auto_send: false,
    days_after_deal: 7,
    google_review_url: null,
    review_note: null,
};

export default function ReviewsSettingsPage() {
    const [data, setData] = useState<SettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<ReviewConfig>(DEFAULT_CONFIG);
    const [requests, setRequests] = useState<ReviewRequestRow[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);

    const loadRequests = useCallback(async () => {
        try {
            setRequestsLoading(true);
            const res = await apiFetch<{ data: ReviewRequestRow[] }>(
                "/api/reviews/requests?limit=10"
            );
            setRequests(res.data || []);
        } catch {
            setRequests([]);
        } finally {
            setRequestsLoading(false);
        }
    }, []);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{ data: SettingsData }>("/api/reviews/settings");
            setData(res.data);
            setConfig(res.data.config);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load review settings");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        void loadRequests();
    }, [load, loadRequests]);

    async function save() {
        try {
            setSaving(true);
            const res = await apiFetch<{ data: SettingsData & { message?: string } }>(
                "/api/reviews/settings",
                {
                    method: "POST",
                    body: config,
                }
            );
            setData(res.data);
            setConfig(res.data.config);
            const savedMessage = (res.data as SettingsData & { message?: string }).message;
            toast.success("Settings saved", savedMessage || "Review settings updated.");
        } catch (err) {
            toast.error("Save failed", err instanceof Error ? err.message : "Try again");
        } finally {
            setSaving(false);
        }
    }

    return (
        <ListPageShell
            title="Review automation"
            description="Request customer reviews after a deal closes. Honest by design: nothing is marked 'sent' unless it actually went out."
            icon={Star}
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => void save()} disabled={saving || loading} loading={saving}>
                        Save settings
                    </Button>
                </div>
            }
        >
            {loading ? (
                <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading review settings…
                </div>
            ) : error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-medium">Could not load review settings</p>
                        <p className="mt-0.5 text-destructive/80">{error}</p>
                    </div>
                </div>
            ) : data ? (
                <div className="mx-auto max-w-2xl space-y-6">
                    {/* Amber not-configured state */}
                    {data.config.enabled && !data.configured && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                                <p className="font-medium">Not configured for auto-send</p>
                                <p className="mt-0.5">
                                    {!data.resend_configured
                                        ? "Resend email (RESEND_API_KEY + EMAIL_FROM) is not configured — review requests will stay as drafts."
                                        : !config.google_review_url
                                          ? "Add a review destination URL (e.g. your Google Business Profile) to enable the review link."
                                          : "Enable auto-send below to send review requests automatically."}
                                </p>
                            </div>
                        </div>
                    )}

                    {data.configured && (
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Review automation is configured and will send review requests when a
                                request is created and the customer has marketing consent.
                            </p>
                        </div>
                    )}

                    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
                        <label className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Enable review automation</p>
                                <p className="text-xs text-muted-foreground">
                                    Queue a review request when a deal closes (or create manually from
                                    the requests list).
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.enabled}
                                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                className="h-4 w-4"
                            />
                        </label>

                        <label className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Auto-send</p>
                                <p className="text-xs text-muted-foreground">
                                    Send review emails automatically. Off = drafts only, sent by your
                                    team from the requests list. Requires Resend + consent.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.auto_send}
                                disabled={!config.enabled}
                                onChange={(e) => setConfig({ ...config, auto_send: e.target.checked })}
                                className="h-4 w-4"
                            />
                        </label>

                        <label className="block space-y-1 text-sm">
                            <span className="font-medium">Days after deal to send</span>
                            <input
                                type="number"
                                min={1}
                                max={90}
                                value={config.days_after_deal}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        days_after_deal: Math.max(1, parseInt(e.target.value) || 7),
                                    })
                                }
                                className="min-h-9 w-24 rounded-md border border-border bg-background px-2 text-sm"
                            />
                        </label>

                        <label className="block space-y-1 text-sm">
                            <span className="font-medium">Review destination URL</span>
                            <input
                                type="url"
                                value={config.google_review_url || ""}
                                onChange={(e) => setConfig({ ...config, google_review_url: e.target.value })}
                                placeholder="https://g.page/r/your-business/review"
                                className="min-h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <span className="text-xs text-muted-foreground">
                                Where the customer lands to leave the review (Google Business Profile,
                                etc.).
                            </span>
                        </label>

                        <label className="block space-y-1 text-sm">
                            <span className="font-medium">Optional message</span>
                            <textarea
                                value={config.review_note || ""}
                                onChange={(e) => setConfig({ ...config, review_note: e.target.value })}
                                rows={3}
                                placeholder="e.g. Thank you for your business!"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </label>
                    </section>

                    <section className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold">Recent review requests</h2>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void loadRequests()}
                                disabled={requestsLoading}
                            >
                                {requestsLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                )}
                                Refresh
                            </Button>
                        </div>
                        {requests.length === 0 ? (
                            <p className="mt-3 text-[13px] text-muted-foreground">
                                No review requests yet. Requests are created from deals and appear here
                                with their honest status.
                            </p>
                        ) : (
                            <ul className="mt-3 divide-y divide-border">
                                {requests.map((req) => (
                                    <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">
                                                {req.customer?.name || "Customer"}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {req.customer?.email || "No email on file"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span
                                                className={`rounded px-1.5 py-0.5 font-semibold ${
                                                    req.status === "sent"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : req.status === "clicked" ||
                                                            req.status === "reviewed"
                                                          ? "bg-blue-100 text-blue-700"
                                                          : "bg-amber-100 text-amber-700"
                                                }`}
                                            >
                                                {req.status}
                                            </span>
                                            {!req.consent_ok && (
                                                <span className="text-muted-foreground">
                                                    no consent
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold">How it stays honest</h2>
                        <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
                            <li>
                                · Requests only go to customers who gave <strong>marketing consent</strong>.
                            </li>
                            <li>
                                · Auto-send requires Resend email credentials, an enabled toggle, and a
                                review destination — otherwise requests remain amber drafts.
                            </li>
                            <li>
                                · No fake &quot;sent&quot; states: status is only marked{" "}
                                <code className="rounded bg-muted px-1">sent</code> after a successful
                                send.
                            </li>
                        </ul>
                    </section>

                    <p className="text-xs text-muted-foreground">{data.note}</p>
                </div>
            ) : null}
        </ListPageShell>
    );
}
