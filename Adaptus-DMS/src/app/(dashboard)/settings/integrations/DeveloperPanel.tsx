"use client";

// Developer tools for SMS quiet hours, webhooks, API tokens, and data export.
// Colocated under Settings → Integrations.

import { useEffect, useState, type ReactNode } from "react";
import {
    CheckCircle2,
    Copy,
    Download,
    Key,
    Loader2,
    MessageSquareText,
    Plus,
    RefreshCw,
    Send,
    Trash2,
    Webhook,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

const WEBHOOK_EVENTS = [
    "deal.created",
    "lead.created",
    "inventory.updated",
    "payment.received",
] as const;

type Webhook = {
    id: string;
    url: string;
    events: string[];
    active: boolean;
    created_at?: string;
};

type ApiToken = {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
};

type SmsStatus = {
    configured: boolean;
    missing: string[];
    from_number: string | null;
    quiet_hours_enabled: boolean;
};

function Section({
    icon,
    title,
    subtitle,
    children,
}: {
    icon: ReactNode;
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-[#2563EB]/10 p-1.5 text-[#2563EB]">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                    {subtitle ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
                    ) : null}
                </div>
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

export function DeveloperPanel({ dealershipId }: { dealershipId: string | null }) {
    const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null);
    const [quietHours, setQuietHours] = useState(false);
    const [savingQuietHours, setSavingQuietHours] = useState(false);

    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [webhookEvents, setWebhookEvents] = useState<string[]>(["deal.created"]);
    const [savingWebhook, setSavingWebhook] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [tokenName, setTokenName] = useState("");
    const [tokenScopes, setTokenScopes] = useState<string[]>(["inventory:read"]);
    const [creatingToken, setCreatingToken] = useState(false);
    const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const [exporting, setExporting] = useState<"json" | "xlsx" | null>(null);

    async function load() {
        const [smsRes, webhookRes, tokenRes] = await Promise.all([
            apiFetch<{ data: { sms: SmsStatus } }>("/api/settings/integrations").catch(
                () => null
            ),
            apiFetch<{ data: { webhooks: Webhook[] } }>("/api/webhooks").catch(() => null),
            apiFetch<{ data: { tokens: ApiToken[] } }>("/api/settings/api-tokens").catch(
                () => null
            ),
        ]);
        const sms = smsRes?.data?.sms;
        setSmsStatus(sms ?? null);
        if (sms) setQuietHours(sms.quiet_hours_enabled);
        setWebhooks(webhookRes?.data?.webhooks ?? []);
        setTokens(tokenRes?.data?.tokens ?? []);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const smsRes = await apiFetch<{ data: { sms: SmsStatus } }>(
                "/api/settings/integrations"
            ).catch(() => null);
            if (cancelled) return;
            const sms = smsRes?.data?.sms;
            setSmsStatus(sms ?? null);
            if (sms) setQuietHours(sms.quiet_hours_enabled);
        })();
        (async () => {
            const webhookRes = await apiFetch<{ data: { webhooks: Webhook[] } }>(
                "/api/webhooks"
            ).catch(() => null);
            if (cancelled) return;
            setWebhooks(webhookRes?.data?.webhooks ?? []);
        })();
        (async () => {
            const tokenRes = await apiFetch<{ data: { tokens: ApiToken[] } }>(
                "/api/settings/api-tokens"
            ).catch(() => null);
            if (cancelled) return;
            setTokens(tokenRes?.data?.tokens ?? []);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function toggleQuietHours() {
        setSavingQuietHours(true);
        try {
            await apiFetch("/api/settings/sms", {
                method: "POST",
                body: { quiet_hours_enabled: !quietHours },
            });
            setQuietHours((v) => !v);
            toast.success("Quiet hours updated");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save quiet hours");
        } finally {
            setSavingQuietHours(false);
        }
    }

    const addWebhook = async () => {
        if (!/^https:\/\//i.test(webhookUrl.trim())) {
            toast.error("Webhook URL must be https://");
            return;
        }
        if (webhookEvents.length === 0) {
            toast.error("Pick at least one event");
            return;
        }
        setSavingWebhook(true);
        try {
            await apiFetch("/api/webhooks", {
                method: "POST",
                body: {
                    url: webhookUrl.trim(),
                    events: webhookEvents,
                },
            });
            toast.success("Webhook added");
            setWebhookUrl("");
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to add webhook");
        } finally {
            setSavingWebhook(false);
        }
    };

    async function deleteWebhook(id: string) {
        try {
            await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
            toast.success("Webhook deleted");
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
        }
    }

    async function testWebhook(id: string) {
        setTestingWebhook(id);
        try {
            const res = await apiFetch<{ data: { ok: boolean }; message?: string }>(
                `/api/webhooks/${id}`,
                {
                    method: "POST",
                    body: { action: "test" },
                }
            );
            if (res.data?.ok) toast.success("Test delivered");
            else toast.error(res.message || "Test failed");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Test failed");
        } finally {
            setTestingWebhook(null);
        }
    }

    async function createToken() {
        if (!tokenName.trim()) {
            toast.error("Token name is required");
            return;
        }
        setCreatingToken(true);
        setOneTimeToken(null);
        try {
            const res = await apiFetch<{ data: { token: string } }>("/api/settings/api-tokens", {
                method: "POST",
                body: {
                    name: tokenName.trim(),
                    scopes: tokenScopes,
                },
            });
            setOneTimeToken(res.data.token);
            setTokenName("");
            toast.success("API token created — copy it now, it is shown once");
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create token");
        } finally {
            setCreatingToken(false);
        }
    }

    async function revokeToken(id: string) {
        try {
            await apiFetch(`/api/settings/api-tokens/${id}`, { method: "DELETE" });
            toast.success("Token revoked");
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to revoke token");
        }
    }

    async function copyToken() {
        if (!oneTimeToken) return;
        try {
            await navigator.clipboard.writeText(oneTimeToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    }

    const downloadExport = (format: "json" | "xlsx") => {
        setExporting(format);
        // Browser follows the auth-cookie download; clear spinner shortly after.
        window.location.assign(
            new URL(`/api/export?format=${format}`, window.location.origin).href
        );
        setTimeout(() => setExporting(null), 2000);
    };

    const toggleScope = (setter: (v: string[]) => void, list: string[], value: string) => {
        setter(list.includes(value) ? list.filter((s) => s !== value) : [...list, value]);
    };

    return (
        <div className="space-y-4">
            <Section
                icon={<MessageSquareText className="h-4 w-4" />}
                title="SMS / Texting"
                subtitle="Consent-gated, quiet-hours enforced, real STOP opt-out."
            >
                {smsStatus && !smsStatus.configured && smsStatus.missing.length > 0 ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p className="font-medium">SMS not configured</p>
                        <p className="mt-0.5">
                            Add via wrangler when ready:{" "}
                            {smsStatus.missing.join(", ")}. No message is ever sent
                            until then.
                        </p>
                    </div>
                ) : smsStatus?.configured ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                        Twilio configured{smsStatus.from_number ? ` · from ${smsStatus.from_number}` : ""}.
                        Inbound webhook: POST /api/sms/inbound · status callback: /api/sms/status.
                    </div>
                ) : null}
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                    <span className="text-sm text-foreground">
                        Quiet hours
                        <span className="block text-xs text-muted-foreground">
                            Block marketing texts outside 9:00 PM – 9:00 AM (dealership
                            time). Blocked sends are logged — never silently sent.
                        </span>
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={quietHours}
                        aria-label="Quiet hours"
                        onClick={() => void toggleQuietHours()}
                        disabled={savingQuietHours || !dealershipId}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                            quietHours ? "bg-[#2563EB]" : "bg-muted"
                        } disabled:opacity-50`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                quietHours ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                    </button>
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                    Customers can reply STOP / ARRET anytime to opt out in real time.
                </p>
            </Section>

            <Section
                icon={<Webhook className="h-4 w-4" />}
                title="Webhooks"
                subtitle="Receive dealership events as signed HTTP POSTs (X-FF-Signature, HMAC-SHA256)."
            >
                <div className="space-y-2">
                    {webhooks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No webhook endpoints yet. Events:{" "}
                            {WEBHOOK_EVENTS.join(", ")}.
                        </p>
                    ) : (
                        webhooks.map((wh) => (
                            <div
                                key={wh.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-foreground">
                                        {wh.url}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        {wh.events.join(", ")}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void testWebhook(wh.id)}
                                    disabled={testingWebhook === wh.id}
                                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                                >
                                    {testingWebhook === wh.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Send className="h-3 w-3" />
                                    )}
                                    Test
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void deleteWebhook(wh.id)}
                                    className="inline-flex min-h-9 items-center rounded-md border border-destructive/30 px-2.5 text-xs font-medium text-destructive hover:bg-destructive-50"
                                    aria-label="Delete webhook"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <div className="mt-3 space-y-2">
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://your-app.example.com/webhook"
                        className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {WEBHOOK_EVENTS.map((ev) => (
                            <button
                                key={ev}
                                type="button"
                                onClick={() => toggleScope(setWebhookEvents, webhookEvents, ev)}
                                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                    webhookEvents.includes(ev)
                                        ? "border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]"
                                        : "border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {ev}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => void addWebhook()}
                        disabled={savingWebhook}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                    >
                        {savingWebhook ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        Add webhook
                    </button>
                </div>
            </Section>

            <Section
                icon={<Key className="h-4 w-4" />}
                title="Open API tokens"
                subtitle="Read-only dealership data via GET /api/external/v1/{inventory|leads|deals}. Token shown once."
            >
                {tokens.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        No API tokens. Create one to expose read-only data.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {tokens.map((t) => (
                            <div
                                key={t.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {t.name}
                                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                                            {t.prefix}…
                                        </span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {t.scopes.join(", ")} · created{" "}
                                        {new Date(t.created_at).toLocaleDateString()}
                                        {t.last_used_at
                                            ? ` · used ${new Date(t.last_used_at).toLocaleDateString()}`
                                            : " · never used"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void revokeToken(t.id)}
                                    className="inline-flex min-h-9 items-center rounded-md border border-destructive/30 px-2.5 text-xs font-medium text-destructive hover:bg-destructive-50"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Revoke
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {oneTimeToken ? (
                    <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                        <p className="text-xs font-medium text-emerald-900">
                            Copy this token now — it is shown once.
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                            <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-[11px] text-emerald-900">
                                {oneTimeToken}
                            </code>
                            <button
                                type="button"
                                onClick={() => void copyToken()}
                                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-emerald-400 px-2 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100"
                            >
                                {copied ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>
                ) : null}
                <div className="mt-3 space-y-2">
                    <input
                        type="text"
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        placeholder="Token name (e.g. Website CMS)"
                        className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {["inventory:read", "leads:read", "deals:read"].map((scope) => (
                            <button
                                key={scope}
                                type="button"
                                onClick={() => toggleScope(setTokenScopes, tokenScopes, scope)}
                                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                    tokenScopes.includes(scope)
                                        ? "border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]"
                                        : "border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {scope}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => void createToken()}
                        disabled={creatingToken}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                    >
                        {creatingToken ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        Create token
                    </button>
                </div>
            </Section>

            <Section
                icon={<Download className="h-4 w-4" />}
                title="Full data export"
                subtitle="Every dealership table as JSON or Excel — your data, always."
            >
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => downloadExport("json")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
                    >
                        {exporting === "json" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Download JSON
                    </button>
                    <button
                        type="button"
                        onClick={() => downloadExport("xlsx")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                        {exporting === "xlsx" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Download Excel (.xlsx)
                    </button>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Generated live from your dealership data (Admin/Manager).
                </p>
            </Section>
        </div>
    );
}
