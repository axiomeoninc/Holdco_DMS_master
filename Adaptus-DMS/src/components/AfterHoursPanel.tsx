"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Clock,
    Moon,
    Loader2,
    Send,
    FileText,
    AlertTriangle,
    Bot,
    ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";
import { AiNotConfiguredBanner } from "@/src/components/ai/AiNotConfiguredBanner";

type ReplyRow = {
    id: string;
    channel: string;
    status: string;
    subject: string | null;
    body: string;
    bot_disclosure: boolean;
    consent_ok: boolean;
    escalated_to_human: boolean;
    escalate_reason: string | null;
    block_reason: string | null;
    error: string | null;
    sent_at: string | null;
    created_at: string;
};

type Props = {
    leadId: string;
    canEdit: boolean;
};

/**
 * After-hours 24/7 AI first response panel.
 * Draft-first; auto-send only when governance enabled + channel configured
 * + consent present + off-hours. Amber states everywhere a path is blocked.
 */
export function AfterHoursPanel({ leadId, canEdit }: Props) {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [missing, setMissing] = useState(false);
    const [replies, setReplies] = useState<ReplyRow[]>([]);
    const [meta, setMeta] = useState<{
        resend_configured: boolean;
        in_quiet_hours: boolean;
        auto_send_enabled: boolean;
    }>({ resend_configured: false, in_quiet_hours: false, auto_send_enabled: false });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch<{ data: ReplyRow[]; meta: typeof meta }>(
                `/api/leads/${leadId}/after-hours`,
                { silent: true }
            );
            setReplies(res.data || []);
            setMeta(res.meta || meta);
        } catch (err) {
            const status = (err as { status?: number }).status;
            if (status === 503) setMissing(true);
        } finally {
            setLoading(false);
        }
    }, [leadId]);

    useEffect(() => {
        void load();
    }, [load]);

    async function run(action: "draft" | "draft_and_send") {
        setBusy(true);
        setMissing(false);
        try {
            const res = await apiFetch<{
                data: { decision: string; body: string; subject: string | null };
                message?: string;
                escalated?: boolean;
            }>(`/api/leads/${leadId}/after-hours`, {
                method: "POST",
                body: { action },
                silent: true,
            });
            if (res.escalated) {
                toast.error("Escalated to human", res.message);
            } else if (res.data?.decision === "sent") {
                toast.success("AI first response sent with bot disclosure");
            } else {
                toast.success(res.message || "Draft ready — review before send");
            }
            await load();
        } catch (err) {
            const status = (err as { status?: number }).status;
            if (status === 503) {
                setMissing(true);
            } else {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        } finally {
            setBusy(false);
        }
    }

    const latest = replies[0];

    return (
        <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Moon className="h-3.5 w-3.5" />
                    After-hours AI first response
                </p>
                <span className="text-[11px] text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {meta.in_quiet_hours ? "Off-hours now" : "Business hours"}
                </span>
            </div>

            {missing ? <AiNotConfiguredBanner compact /> : null}

            {!meta.in_quiet_hours && (
                <p className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                    This lead arrived during business hours — desk handles
                    replies. Drafts can still be prepared here.
                </p>
            )}

            {!meta.auto_send_enabled && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                    Auto-send is off (AI Governance). Drafts are saved for human
                    review.
                </p>
            )}

            {canEdit && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        leftIcon={
                            busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FileText className="h-3.5 w-3.5" />
                            )
                        }
                        onClick={() => void run("draft")}
                    >
                        Draft AI first response
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        leftIcon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => void run("draft_and_send")}
                    >
                        Draft &amp; send (gated)
                    </Button>
                </div>
            )}

            {latest ? (
                <div className="space-y-2">
                    {latest.status === "escalated" ? (
                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>
                                Escalated to human — {latest.escalate_reason}.
                                No auto-reply was sent.
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                                {latest.subject ? (
                                    <p className="font-medium text-foreground">
                                        {latest.subject}
                                    </p>
                                ) : null}
                                <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                                    {latest.body}
                                </p>
                            </div>
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1 capitalize">
                                    <Bot className="h-3 w-3" />
                                    {latest.status}
                                </span>
                                {latest.bot_disclosure && (
                                    <span className="flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" />
                                        Bot disclosure included
                                    </span>
                                )}
                                <span>
                                    Consent: {latest.consent_ok ? "yes" : "no"}
                                </span>
                                {latest.error && <span>{latest.error}</span>}
                            </p>
                        </>
                    )}
                    {replies.length > 1 && (
                        <p className="text-[11px] text-muted-foreground">
                            {replies.length - 1} earlier attempt
                            {replies.length === 2 ? "" : "s"}
                        </p>
                    )}
                </div>
            ) : (
                !loading && (
                    <p className="text-xs text-muted-foreground">
                        No after-hours reply has been drafted for this lead yet.
                    </p>
                )
            )}
        </div>
    );
}
