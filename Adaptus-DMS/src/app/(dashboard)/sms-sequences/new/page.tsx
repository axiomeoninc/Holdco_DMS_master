"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import {
    SmsSequenceEditor,
    type SmsSequenceDraft,
} from "@/src/components/SmsSequenceEditor";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

export default function NewSmsSequencePage() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    async function create(draft: SmsSequenceDraft) {
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
            const res = await apiFetch<{ data?: { id?: string } }>(
                "/api/sms/sequences",
                {
                    method: "POST",
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
                }
            );
            toast.success("SMS sequence created");
            const id = res.data?.id;
            router.push(id ? `/sms-sequences/${id}` : "/sms-sequences");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Could not create sequence"
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <ListPageShell
            title="New SMS sequence"
            description="1–10 steps. Admin or Manager required."
            icon={MessageSquare}
            breadcrumbs={[
                { label: "Sales", href: "/leads" },
                { label: "SMS sequences", href: "/sms-sequences" },
                { label: "New" },
            ]}
        >
            <SmsSequenceEditor
                mode="create"
                busy={busy}
                onSubmit={(d) => void create(d)}
                onCancel={() => router.push("/sms-sequences")}
            />
        </ListPageShell>
    );
}
