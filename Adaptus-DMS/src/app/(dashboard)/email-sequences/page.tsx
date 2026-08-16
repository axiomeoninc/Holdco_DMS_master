"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    Loader2,
    Mail,
    Plus,
    RefreshCw,
    AlertCircle,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

type SequenceRow = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    email_sequence_steps?: { count: number }[] | unknown;
};

type EnrollmentRow = {
    id: string;
    status: string;
    current_step: number;
    next_send_at: string | null;
    enrolled_at: string;
    lead_id: string | null;
    customer_id: string | null;
    sequence: { id: string; name: string } | null;
    sends?: { status: string; step_order: number; error: string | null }[];
};

export default function EmailSequencesPage() {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendConfigured, setResendConfigured] = useState(false);
    const [sequences, setSequences] = useState<SequenceRow[]>([]);
    const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [seqRes, enrRes] = await Promise.all([
                apiFetch<{
                    data: SequenceRow[];
                    meta?: { resend_configured?: boolean };
                }>("/api/email-sequences"),
                apiFetch<{
                    data: EnrollmentRow[];
                    meta?: { resend_configured?: boolean };
                }>("/api/email-sequences/enrollments"),
            ]);
            setSequences(seqRes.data || []);
            setEnrollments(enrRes.data || []);
            setResendConfigured(
                Boolean(
                    seqRes.meta?.resend_configured ??
                        enrRes.meta?.resend_configured
                )
            );
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

    async function ensureDefault() {
        try {
            setBusy(true);
            await apiFetch("/api/email-sequences", {
                method: "POST",
                body: { ensure_default: true },
            });
            toast.success("Default lead nurture sequence ready");
            await load();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not create default"
            );
        } finally {
            setBusy(false);
        }
    }

    function stepCount(row: SequenceRow): number {
        const raw = row.email_sequence_steps;
        if (Array.isArray(raw) && raw[0] && typeof raw[0] === "object" && "count" in raw[0]) {
            return Number((raw[0] as { count: number }).count) || 0;
        }
        return 0;
    }

    return (
        <ListPageShell
            title="Email sequences"
            description="Lead nurture follow-ups via Resend — enroll from a lead; Send next for later steps"
            icon={Mail}
            breadcrumbs={[
                { label: "Sales", href: "/leads" },
                { label: "Email sequences" },
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
                        onClick={() => void ensureDefault()}
                        disabled={busy}
                    >
                        Ensure default nurture
                    </Button>
                </div>
            }
        >
            {!loading && !resendConfigured && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-medium">
                            Not configured — add via wrangler when ready
                        </p>
                        <p className="mt-0.5 text-xs text-amber-900/90">
                            Sequences and enrollments work, but emails will not
                            send until{" "}
                            <code className="rounded bg-amber-100/80 px-1">
                                RESEND_API_KEY
                            </code>{" "}
                            and{" "}
                            <code className="rounded bg-amber-100/80 px-1">
                                EMAIL_FROM
                            </code>{" "}
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
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : (
                <div className="space-y-8">
                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Templates
                        </h2>
                        {sequences.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No sequences yet. Click “Ensure default nurture”
                                or enroll a lead from Lead Center.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {sequences.map((s) => (
                                    <div
                                        key={s.id}
                                        className="rounded-lg border border-border bg-card px-4 py-3"
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
                                                {stepCount(s)} steps
                                            </span>
                                        </div>
                                        {s.description && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {s.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Recent enrollments
                        </h2>
                        {enrollments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Open a lead → Email sequence → Enroll in lead
                                nurture.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">
                                                Sequence
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                                Status
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                                Step
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                                Sends
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                                Enrolled
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enrollments.map((e) => (
                                            <tr
                                                key={e.id}
                                                className="border-b border-border last:border-0"
                                            >
                                                <td className="px-3 py-2">
                                                    {e.sequence?.name || "—"}
                                                </td>
                                                <td className="px-3 py-2 capitalize">
                                                    {e.status}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {e.current_step}
                                                    {e.next_send_at
                                                        ? ` · next ${new Date(e.next_send_at).toLocaleDateString()}`
                                                        : ""}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                                    {(e.sends || [])
                                                        .map(
                                                            (s) =>
                                                                `${s.step_order}:${s.status}`
                                                        )
                                                        .join(", ") || "—"}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                                    {new Date(
                                                        e.enrolled_at
                                                    ).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </ListPageShell>
    );
}
