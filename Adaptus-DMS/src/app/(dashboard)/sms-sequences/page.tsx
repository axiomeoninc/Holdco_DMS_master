"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    Loader2,
    MessageSquare,
    Plus,
    RefreshCw,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import {
    SmsEnrollmentTable,
    type SmsEnrollmentRow,
} from "@/src/components/SmsEnrollmentTable";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

type SequenceStep = {
    id?: string;
    step_order: number;
    delay_days: number;
    body_text: string;
};

type SequenceRow = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    steps?: SequenceStep[];
};

export default function SmsSequencesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [twilioConfigured, setTwilioConfigured] = useState<boolean | null>(
        null
    );
    const [missingTwilio, setMissingTwilio] = useState<string[]>([]);
    const [sequences, setSequences] = useState<SequenceRow[]>([]);
    const [enrollments, setEnrollments] = useState<SmsEnrollmentRow[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [seqRes, enrRes, integRes] = await Promise.all([
                apiFetch<{ data: SequenceRow[] }>("/api/sms/sequences"),
                apiFetch<{ data: SmsEnrollmentRow[] }>(
                    "/api/sms/sequences/enrollments"
                ),
                apiFetch<{
                    data?: {
                        sms?: {
                            configured?: boolean;
                            missing?: string[];
                        };
                    };
                }>("/api/settings/integrations").catch(() => null),
            ]);
            setSequences(seqRes.data || []);
            setEnrollments(enrRes.data || []);
            const sms = integRes?.data?.sms;
            if (sms) {
                setTwilioConfigured(Boolean(sms.configured));
                setMissingTwilio(sms.missing || []);
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load sequences"
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function sendNext(enrollmentId: string) {
        try {
            setBusyId(enrollmentId);
            const res = await apiFetch<{
                data?: { status?: string; message?: string };
            }>(`/api/sms/sequences/enrollments/${enrollmentId}/send-next`, {
                method: "POST",
                silent: true,
                silent5xx: true,
            });
            const status = res.data?.status;
            toast.success(
                status === "sent"
                    ? "Step sent"
                    : status
                      ? `Step ${status}`
                      : "Send next completed"
            );
            await load();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not send next step"
            );
        } finally {
            setBusyId(null);
        }
    }

    return (
        <ListPageShell
            title="SMS sequences"
            description="Templates for consent-gated follow-ups via Twilio — enroll a lead or customer; Send next for later steps"
            icon={MessageSquare}
            breadcrumbs={[
                { label: "Sales", href: "/leads" },
                { label: "SMS sequences" },
            ]}
            actions={
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                        onClick={() => void load()}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => router.push("/sms-sequences/new")}
                    >
                        New sequence
                    </Button>
                </div>
            }
        >
            {!loading && twilioConfigured === false && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-medium">
                            Not configured — add via wrangler when ready
                        </p>
                        <p className="mt-0.5 text-xs text-amber-900/90">
                            Sequences and enrollments work, but texts will not
                            send until{" "}
                            {(missingTwilio.length
                                ? missingTwilio
                                : [
                                      "TWILIO_ACCOUNT_SID",
                                      "TWILIO_AUTH_TOKEN",
                                      "TWILIO_FROM_NUMBER",
                                  ]
                            ).map((key, i, arr) => (
                                <span key={key}>
                                    <code className="rounded bg-amber-100/80 px-1">
                                        {key}
                                    </code>
                                    {i < arr.length - 1 ? " / " : ""}
                                </span>
                            ))}{" "}
                            are set on the Worker. See{" "}
                            <Link
                                href="/settings/integrations"
                                className="font-medium underline"
                            >
                                Integrations
                            </Link>
                            . No fake “Sent” status.
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="space-y-8">
                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Templates
                        </h2>
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    </section>
                </div>
            ) : error ? (
                <div className="space-y-8">
                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Templates
                        </h2>
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    </section>
                </div>
            ) : (
                <div className="space-y-8">
                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Templates
                        </h2>
                        {sequences.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No sequences yet. The default 2-step follow-up
                                is created on first load — try Refresh, or{" "}
                                <Link
                                    href="/sms-sequences/new"
                                    className="font-medium underline"
                                >
                                    create a sequence
                                </Link>
                                .
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {sequences.map((s) => {
                                    const steps = Array.isArray(s.steps)
                                        ? [...s.steps].sort(
                                              (a, b) =>
                                                  a.step_order - b.step_order
                                          )
                                        : [];
                                    return (
                                        <Link
                                            key={s.id}
                                            href={`/sms-sequences/${s.id}`}
                                            className="block rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/40"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium text-foreground">
                                                    {s.name}
                                                </span>
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                                    {s.is_active
                                                        ? "active"
                                                        : "inactive"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {steps.length} steps
                                                </span>
                                            </div>
                                            {s.description && (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {s.description}
                                                </p>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Recent enrollments
                        </h2>
                        <SmsEnrollmentTable
                            enrollments={enrollments}
                            busyId={busyId}
                            onSendNext={(id) => void sendNext(id)}
                        />
                    </section>
                </div>
            )}
        </ListPageShell>
    );
}
