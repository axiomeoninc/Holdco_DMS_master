"use client";

import { useCallback, useEffect, useState } from "react";
import {
    ShieldCheck,
    Moon,
    ClipboardList,
    Loader2,
    Save,
    AlertTriangle,
    Bot,
    ScrollText,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { formatClock } from "@/src/lib/ai/clock";

type GovernanceConfig = {
    claims_guardrail_enabled: boolean;
    blocked_claims: string[];
    allowed_claims: string[];
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    quiet_hours_timezone: string;
    auto_send_enabled: boolean;
    escalation_on_pricing: boolean;
    configured: boolean;
};

type CorrectionRow = {
    id: string;
    kind: string;
    original_text: string | null;
    corrected_text: string;
    corrected_at: string;
    context: Record<string, unknown>;
};

type ReplyRow = {
    id: string;
    status: string;
    channel: string;
    bot_disclosure: boolean;
    consent_ok: boolean;
    escalated_to_human: boolean;
    created_at: string;
};

type GovernanceData = {
    config: GovernanceConfig;
    can_edit: boolean;
    consent_summary: {
        marketing_consent: number;
        sms_consent: number;
        unsubscribed: number;
    };
    corrections: CorrectionRow[];
    replies: ReplyRow[];
};

function listFromText(value: string): string[] {
    return value
        .split("\n")
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);
}

function textFromList(value: string[]): string {
    return (value || []).join("\n");
}

export default function AiGovernancePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [data, setData] = useState<GovernanceData | null>(null);

    const [blockedText, setBlockedText] = useState("");
    const [allowedText, setAllowedText] = useState("");
    const [quietStart, setQuietStart] = useState("20:00");
    const [quietEnd, setQuietEnd] = useState("09:00");
    const [quietEnabled, setQuietEnabled] = useState(true);
    const [claimsEnabled, setClaimsEnabled] = useState(true);
    const [autoSend, setAutoSend] = useState(false);
    const [escalationOnPricing, setEscalationOnPricing] = useState(true);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{ data: GovernanceData }>(
                "/api/settings/ai-governance"
            );
            const d = res.data;
            setData(d);
            setCanEdit(Boolean(d.can_edit));
            setClaimsEnabled(d.config.claims_guardrail_enabled);
            setBlockedText(textFromList(d.config.blocked_claims));
            setAllowedText(textFromList(d.config.allowed_claims));
            setQuietEnabled(d.config.quiet_hours_enabled);
            setQuietStart(d.config.quiet_hours_start);
            setQuietEnd(d.config.quiet_hours_end);
            setAutoSend(Boolean(d.config.auto_send_enabled));
            setEscalationOnPricing(Boolean(d.config.escalation_on_pricing));
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load AI governance"
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function save() {
        if (!canEdit) return;
        try {
            setSaving(true);
            await apiFetch("/api/settings/ai-governance", {
                method: "PATCH",
                body: {
                    claims_guardrail_enabled: claimsEnabled,
                    blocked_claims: listFromText(blockedText),
                    allowed_claims: listFromText(allowedText),
                    quiet_hours_enabled: quietEnabled,
                    quiet_hours_start: quietStart.trim(),
                    quiet_hours_end: quietEnd.trim(),
                    auto_send_enabled: autoSend,
                    escalation_on_pricing: escalationOnPricing,
                },
            });
            toast.success("Saved", "AI governance settings updated.");
            await load();
        } catch (err) {
            toast.error(
                "Save failed",
                err instanceof Error ? err.message : "Please try again."
            );
        } finally {
            setSaving(false);
        }
    }

    const fieldClass =
        "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60";
    const toggleClass = (on: boolean) =>
        `relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            on ? "bg-primary" : "bg-muted-foreground/30"
        }`;

    const toggle = (on: boolean, set: (v: boolean) => void) => (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={!canEdit}
            onClick={() => set(!on)}
            className={toggleClass(on)}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    on ? "translate-x-[18px]" : "translate-x-1"
                }`}
            />
        </button>
    );

    return (
        <ListPageShell
            title="AI Governance"
            description="Claims guardrails, consent tracking, quiet hours, and the AI correction log"
            icon={ShieldCheck}
            breadcrumbs={[
                { label: "Settings", href: "/settings/business" },
                { label: "AI Governance" },
            ]}
            actions={
                canEdit ? (
                    <Button
                        size="sm"
                        onClick={() => void save()}
                        disabled={saving || loading}
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save
                    </Button>
                ) : undefined
            }
        >
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : data ? (
                <div className="max-w-3xl space-y-6">
                    {!canEdit && (
                        <p className="text-sm text-muted-foreground">
                            View only — Admin/Manager or settings:write required to
                            edit.
                        </p>
                    )}

                    {/* Claims guardrails */}
                    <section className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ScrollText className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    Claims guardrails
                                </h3>
                            </div>
                            {toggle(claimsEnabled, setClaimsEnabled)}
                        </div>
                        <p className="mb-4 text-xs text-muted-foreground">
                            FTC position: &quot;AI claims are dealer claims.&quot; Blocked
                            phrases are scanned on AI output before it is shown to
                            customers or saved. Leave empty to use the platform
                            default list.
                        </p>
                        <div className="space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Blocked claims (one per line)
                                </span>
                                <textarea
                                    className={`${fieldClass} font-mono text-xs`}
                                    rows={6}
                                    disabled={!canEdit}
                                    value={blockedText}
                                    onChange={(e) => setBlockedText(e.target.value)}
                                    placeholder="best price guarantee&#10;guaranteed approval&#10;no credit check"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Allowed claims (explicit overrides, one per line)
                                </span>
                                <textarea
                                    className={`${fieldClass} font-mono text-xs`}
                                    rows={3}
                                    disabled={!canEdit}
                                    value={allowedText}
                                    onChange={(e) => setAllowedText(e.target.value)}
                                />
                            </label>
                        </div>
                    </section>

                    {/* Quiet hours + after-hours */}
                    <section className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Moon className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    Quiet hours &amp; after-hours AI
                                </h3>
                            </div>
                            {toggle(quietEnabled, setQuietEnabled)}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Quiet hours start (HH:MM)
                                </span>
                                <input
                                    className={fieldClass}
                                    disabled={!canEdit || !quietEnabled}
                                    value={quietStart}
                                    onChange={(e) => setQuietStart(e.target.value)}
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Quiet hours end (HH:MM)
                                </span>
                                <input
                                    className={fieldClass}
                                    disabled={!canEdit || !quietEnabled}
                                    value={quietEnd}
                                    onChange={(e) => setQuietEnd(e.target.value)}
                                />
                            </label>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Window: {formatClock(quietStart)} –{" "}
                            {formatClock(quietEnd)} (
                            {data.config.quiet_hours_timezone || "America/Toronto"}
                            ). Enforcement uses server-local time.
                        </p>
                        <div className="mt-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                            <div>
                                <p className="text-sm font-medium text-amber-900">
                                    Auto-send after-hours first response
                                </p>
                                <p className="text-xs text-amber-800/80">
                                    Draft-first until enabled. When on, replies send
                                    only during quiet hours with consent + bot
                                    disclosure + escalation checks.
                                </p>
                            </div>
                            {toggle(autoSend, setAutoSend)}
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-md border border-border px-3 py-2">
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    Escalate on pricing / finance / human requests
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Never auto-reply when a lead asks about price,
                                    financing, trade-in, or a person.
                                </p>
                            </div>
                            {toggle(escalationOnPricing, setEscalationOnPricing)}
                        </div>
                    </section>

                    {/* Consent tracking */}
                    <section className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold text-foreground">
                                Consent tracking (CASL)
                            </h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-md bg-muted/50 p-3">
                                <p className="text-2xl font-bold tabular-nums">
                                    {data.consent_summary.marketing_consent}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Marketing email consent
                                </p>
                            </div>
                            <div className="rounded-md bg-muted/50 p-3">
                                <p className="text-2xl font-bold tabular-nums">
                                    {data.consent_summary.sms_consent}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    SMS consent
                                </p>
                            </div>
                            <div className="rounded-md bg-muted/50 p-3">
                                <p className="text-2xl font-bold tabular-nums">
                                    {data.consent_summary.unsubscribed}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Unsubscribed
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* After-hours activity */}
                    <section className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold text-foreground">
                                After-hours AI activity
                            </h3>
                        </div>
                        {data.replies.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No after-hours AI replies yet.
                            </p>
                        ) : (
                            <ul className="space-y-1.5 text-xs">
                                {data.replies.slice(0, 10).map((r) => (
                                    <li
                                        key={r.id}
                                        className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5"
                                    >
                                        <span className="capitalize text-foreground">
                                            {r.status}
                                            {r.escalated_to_human
                                                ? " (escalated)"
                                                : ""}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {r.channel} · bot disclosure:{" "}
                                            {r.bot_disclosure ? "yes" : "no"} ·
                                            consent: {r.consent_ok ? "yes" : "no"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Correction log */}
                    <section className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold text-foreground">
                                Correction log
                            </h3>
                        </div>
                        {data.corrections.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No AI output corrections recorded. Corrections made
                                via Flash AI actions can be logged here to keep the
                                FTC-ready paper trail.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {data.corrections.slice(0, 10).map((c) => (
                                    <li
                                        key={c.id}
                                        className="rounded-md bg-muted/40 px-3 py-2 text-xs"
                                    >
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="font-medium uppercase tracking-wide">
                                                {c.kind}
                                            </span>
                                            <span>
                                                {new Date(
                                                    c.corrected_at
                                                ).toLocaleString()}
                                            </span>
                                        </div>
                                        {c.original_text && (
                                            <p className="mt-1 line-through opacity-60">
                                                {c.original_text.slice(0, 200)}
                                            </p>
                                        )}
                                        <p className="mt-0.5 text-foreground">
                                            {c.corrected_text.slice(0, 240)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            ) : null}
        </ListPageShell>
    );
}
