"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Ban, Send } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";

type SendRow = {
    id: string;
    step_order: number;
    status: string;
    to_email: string;
    error: string | null;
    resend_id: string | null;
    sent_at: string;
};

type Enrollment = {
    id: string;
    status: string;
    current_step: number;
    next_send_at: string | null;
    stop_reason: string | null;
    sequence: { id: string; name: string; is_active: boolean } | null;
    sends?: SendRow[];
};

type Props = {
    leadId: string;
    customerEmail: string | null;
    canEdit: boolean;
};

export function LeadEmailSequencePanel({
    leadId,
    customerEmail,
    canEdit,
}: Props) {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [resendConfigured, setResendConfigured] = useState<boolean | null>(
        null
    );
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch<{
                data: Enrollment[];
                meta?: { resend_configured?: boolean };
            }>(`/api/email-sequences/enrollments?lead_id=${leadId}`);
            setEnrollments(res.data || []);
            setResendConfigured(Boolean(res.meta?.resend_configured));
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to load sequences"
            );
        } finally {
            setLoading(false);
        }
    }, [leadId]);

    useEffect(() => {
        void load();
    }, [load]);

    const active = enrollments.find((e) => e.status === "active");

    async function enroll() {
        if (!customerEmail?.trim()) {
            toast.error("Customer needs an email before enrolling");
            return;
        }
        try {
            setBusy(true);
            const res = await apiFetch<{
                data: Enrollment;
                first_send?: {
                    ok?: boolean;
                    error?: string;
                    missingConfig?: boolean;
                };
                meta?: { resend_configured?: boolean };
            }>("/api/email-sequences/enrollments", {
                method: "POST",
                body: {
                    lead_id: leadId,
                    ensure_default: true,
                    send_first: true,
                },
            });
            setResendConfigured(Boolean(res.meta?.resend_configured));
            if (res.first_send && res.first_send.ok === false) {
                if (res.first_send.missingConfig) {
                    toast.error(
                        "Enrolled — email not sent (Resend not configured). See Integrations."
                    );
                } else {
                    toast.error(
                        res.first_send.error ||
                            "Enrolled, but first email was not sent"
                    );
                }
            } else if (res.first_send?.ok) {
                toast.success("Enrolled — first email sent");
            } else {
                toast.success("Enrolled in lead nurture sequence");
            }
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Enroll failed");
        } finally {
            setBusy(false);
        }
    }

    async function sendNext(enrollmentId: string) {
        try {
            setBusy(true);
            await apiFetch(`/api/email-sequences/enrollments/${enrollmentId}/send-next`, {
                method: "POST",
                body: {},
            });
            toast.success("Next step sent");
            await load();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Send next failed"
            );
        } finally {
            setBusy(false);
        }
    }

    async function stop(enrollmentId: string) {
        try {
            setBusy(true);
            await apiFetch(
                `/api/email-sequences/enrollments/${enrollmentId}/stop`,
                {
                    method: "POST",
                    body: { reason: "dealer_stop" },
                }
            );
            toast.success("Sequence stopped");
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Stop failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                    Email sequence
                </h3>
                <Link
                    href="/email-sequences"
                    className="text-[11px] font-medium text-[#2563EB] hover:underline"
                >
                    Manage
                </Link>
            </div>

            {resendConfigured === false && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                    Not configured — add via wrangler when ready. Enroll works;
                    Send next stays blocked. See{" "}
                    <Link
                        href="/settings/integrations"
                        className="font-medium underline"
                    >
                        Integrations
                    </Link>
                    .
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="mt-2 space-y-2">
                    {active ? (
                        <>
                            <p className="text-xs text-muted-foreground">
                                Active:{" "}
                                <span className="font-medium text-foreground">
                                    {active.sequence?.name || "Sequence"}
                                </span>{" "}
                                · step {active.current_step}
                                {active.next_send_at
                                    ? ` · next ${new Date(active.next_send_at).toLocaleDateString()}`
                                    : ""}
                            </p>
                            {(active.sends || []).length > 0 && (
                                <ul className="space-y-1 text-[11px] text-muted-foreground">
                                    {(active.sends || [])
                                        .slice()
                                        .sort(
                                            (a, b) =>
                                                a.step_order - b.step_order
                                        )
                                        .map((s) => (
                                            <li key={s.id}>
                                                Step {s.step_order}: {s.status}
                                                {s.error ? ` — ${s.error}` : ""}
                                            </li>
                                        ))}
                                </ul>
                            )}
                            {canEdit && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy || resendConfigured === false}
                                        leftIcon={
                                            <Send className="h-3.5 w-3.5" />
                                        }
                                        onClick={() => void sendNext(active.id)}
                                    >
                                        Send next
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        leftIcon={
                                            <Ban className="h-3.5 w-3.5" />
                                        }
                                        onClick={() => void stop(active.id)}
                                    >
                                        Stop
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-muted-foreground">
                                No active email nurture for this lead.
                                {!customerEmail?.trim() &&
                                    " Add a customer email first."}
                            </p>
                            {canEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        busy || !customerEmail?.trim()
                                    }
                                    leftIcon={<Mail className="h-3.5 w-3.5" />}
                                    onClick={() => void enroll()}
                                >
                                    Enroll in lead nurture
                                </Button>
                            )}
                        </>
                    )}

                    {enrollments.filter((e) => e.status !== "active").length >
                        0 && (
                        <p className="text-[11px] text-muted-foreground">
                            Past:{" "}
                            {enrollments
                                .filter((e) => e.status !== "active")
                                .map(
                                    (e) =>
                                        `${e.sequence?.name || "Sequence"} (${e.status})`
                                )
                                .join(", ")}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
