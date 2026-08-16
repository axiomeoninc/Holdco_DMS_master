"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import {
    SmsEnrollmentTable,
    type SmsEnrollmentRow,
} from "@/src/components/SmsEnrollmentTable";
import {
    SmsSequenceEditor,
    type SmsSequenceDraft,
} from "@/src/components/SmsSequenceEditor";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

type SequenceStep = {
    id?: string;
    step_order: number;
    delay_days: number;
    body_text: string;
};

type SequenceDetail = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    steps?: SequenceStep[];
};

export default function SmsSequenceDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const id = params?.id;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sequence, setSequence] = useState<SequenceDetail | null>(null);
    const [enrollments, setEnrollments] = useState<SmsEnrollmentRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [enrollCustomerId, setEnrollCustomerId] = useState("");
    const [enrollLeadId, setEnrollLeadId] = useState("");
    const [enrolling, setEnrolling] = useState(false);

    const load = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const [seqRes, enrRes] = await Promise.all([
                apiFetch<{ data: SequenceDetail }>(`/api/sms/sequences/${id}`),
                apiFetch<{ data: SmsEnrollmentRow[] }>(
                    `/api/sms/sequences/enrollments?sequence_id=${encodeURIComponent(id)}`
                ),
            ]);
            setSequence(seqRes.data || null);
            setEnrollments(enrRes.data || []);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load sequence"
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    async function save(draft: SmsSequenceDraft) {
        if (!id) return;
        if (!draft.name) {
            toast.error("Name is required");
            return;
        }
        if (
            draft.steps.length === 0 ||
            draft.steps.some((s) => !s.body_text.trim())
        ) {
            toast.error("Each step needs a message body");
            return;
        }
        try {
            setBusy(true);
            await apiFetch(`/api/sms/sequences/${id}`, {
                method: "PATCH",
                body: {
                    name: draft.name,
                    description: draft.description || null,
                    is_active: draft.is_active,
                    steps: draft.steps.map((s) => ({
                        step_order: s.step_order,
                        delay_days: s.delay_days,
                        body_text: s.body_text.trim(),
                    })),
                },
            });
            toast.success("SMS sequence updated");
            await load();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not update sequence"
            );
        } finally {
            setBusy(false);
        }
    }

    async function enroll() {
        if (!id) return;
        const customer_id = enrollCustomerId.trim() || undefined;
        const lead_id = enrollLeadId.trim() || undefined;
        if (!customer_id && !lead_id) {
            toast.error("Provide a customer id or lead id");
            return;
        }
        try {
            setEnrolling(true);
            await apiFetch(`/api/sms/sequences/${id}/enroll`, {
                method: "POST",
                body: { customer_id, lead_id },
                silent: true,
                silent5xx: true,
            });
            toast.success("Enrolled. First message will send when due.");
            setEnrollCustomerId("");
            setEnrollLeadId("");
            await load();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not enroll"
            );
        } finally {
            setEnrolling(false);
        }
    }

    async function sendNext(enrollmentId: string) {
        try {
            setBusyId(enrollmentId);
            const res = await apiFetch<{
                data?: { status?: string };
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

    const steps = sequence?.steps
        ? [...sequence.steps].sort((a, b) => a.step_order - b.step_order)
        : [];

    return (
        <ListPageShell
            title={sequence?.name || "SMS sequence"}
            description="Edit steps, enroll a consenting customer or lead, Send next for due steps"
            icon={MessageSquare}
            breadcrumbs={[
                { label: "Sales", href: "/leads" },
                { label: "SMS sequences", href: "/sms-sequences" },
                { label: sequence?.name || "Sequence" },
            ]}
        >
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : error || !sequence ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error || "Sequence not found"}
                </div>
            ) : (
                <div className="space-y-8">
                    <SmsSequenceEditor
                        key={sequence.id}
                        mode="edit"
                        initial={{
                            name: sequence.name,
                            description: sequence.description || "",
                            is_active: sequence.is_active,
                            steps,
                        }}
                        busy={busy}
                        onSubmit={(d) => void save(d)}
                        onCancel={() => router.push("/sms-sequences")}
                    />

                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Enroll
                        </h2>
                        <p className="mb-3 text-xs text-muted-foreground">
                            Exactly one of customer id or lead id. Customer must
                            have SMS consent and a phone.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <Input
                                label="Customer id"
                                value={enrollCustomerId}
                                onChange={(e) =>
                                    setEnrollCustomerId(e.target.value)
                                }
                                placeholder="uuid"
                                containerClassName="flex-1"
                            />
                            <Input
                                label="Lead id"
                                value={enrollLeadId}
                                onChange={(e) =>
                                    setEnrollLeadId(e.target.value)
                                }
                                placeholder="uuid"
                                containerClassName="flex-1"
                            />
                            <Button
                                variant="primary"
                                size="sm"
                                disabled={enrolling || !sequence.is_active}
                                onClick={() => void enroll()}
                            >
                                {enrolling ? "Enrolling…" : "Enroll"}
                            </Button>
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Enrollments
                        </h2>
                        <SmsEnrollmentTable
                            enrollments={enrollments}
                            showSequence={false}
                            busyId={busyId}
                            onSendNext={(eid) => void sendNext(eid)}
                        />
                    </section>
                </div>
            )}
        </ListPageShell>
    );
}
