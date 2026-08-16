"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";

export type SmsStepDraft = {
    step_order: number;
    delay_days: number;
    body_text: string;
};

export type SmsSequenceDraft = {
    name: string;
    description: string;
    is_active: boolean;
    steps: SmsStepDraft[];
};

export const DEFAULT_SMS_STEPS: SmsStepDraft[] = [
    {
        step_order: 1,
        delay_days: 0,
        body_text:
            "Hi {{first_name}}, thanks for contacting {{dealership}}{{vehicle_clause}}. Reply STOP anytime to opt out of texts.",
    },
    {
        step_order: 2,
        delay_days: 2,
        body_text:
            "Hi {{first_name}}, just checking in from {{dealership}}{{vehicle_clause}}. Reply STOP anytime to opt out.",
    },
];

function renumber(steps: SmsStepDraft[]): SmsStepDraft[] {
    return steps.map((s, i) => ({ ...s, step_order: i + 1 }));
}

export function SmsSequenceEditor({
    mode,
    initial,
    busy,
    onSubmit,
    onCancel,
}: {
    mode: "create" | "edit";
    initial?: Partial<SmsSequenceDraft>;
    busy: boolean;
    onSubmit: (draft: SmsSequenceDraft) => void;
    onCancel?: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [isActive, setIsActive] = useState(initial?.is_active ?? true);
    const [steps, setSteps] = useState<SmsStepDraft[]>(
        initial?.steps?.length ? initial.steps : DEFAULT_SMS_STEPS
    );

    function updateStep(index: number, patch: Partial<SmsStepDraft>) {
        setSteps((prev) =>
            prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
        );
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        onSubmit({
            name: name.trim(),
            description: description.trim(),
            is_active: isActive,
            steps: renumber(steps),
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
                <Input
                    label="Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="SMS follow-up (2-step)"
                />
                <Input
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                />
                {mode === "edit" && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                        <span className="text-sm text-foreground">Active</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            aria-label="Sequence active"
                            onClick={() => setIsActive((v) => !v)}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                isActive ? "bg-[#2563EB]" : "bg-muted"
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                                    isActive ? "translate-x-5" : "translate-x-0.5"
                                }`}
                            />
                        </button>
                    </label>
                )}
            </div>

            <section>
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                        Steps
                    </h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                        disabled={steps.length >= 10}
                        onClick={() =>
                            setSteps((prev) =>
                                renumber([
                                    ...prev,
                                    {
                                        step_order: prev.length + 1,
                                        delay_days: 1,
                                        body_text: "",
                                    },
                                ])
                            )
                        }
                    >
                        Add step
                    </Button>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                    Tokens:{" "}
                    <code className="rounded bg-muted px-1">
                        {"{{first_name}}"}
                    </code>{" "}
                    <code className="rounded bg-muted px-1">
                        {"{{dealership}}"}
                    </code>{" "}
                    <code className="rounded bg-muted px-1">
                        {"{{vehicle_clause}}"}
                    </code>
                    . Include STOP language. 1–10 steps.
                </p>
                <div className="space-y-3">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className="rounded-lg border border-border bg-card px-4 py-3"
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Step {index + 1}
                                </span>
                                {steps.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setSteps((prev) =>
                                                renumber(
                                                    prev.filter((_, i) => i !== index)
                                                )
                                            )
                                        }
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                                <Input
                                    label="Delay (days)"
                                    type="number"
                                    min={0}
                                    value={String(step.delay_days)}
                                    onChange={(e) =>
                                        updateStep(index, {
                                            delay_days: Math.max(
                                                0,
                                                Number(e.target.value) || 0
                                            ),
                                        })
                                    }
                                />
                                <Textarea
                                    label="Body"
                                    required
                                    rows={3}
                                    value={step.body_text}
                                    onChange={(e) =>
                                        updateStep(index, {
                                            body_text: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={busy}>
                    {mode === "create" ? "Create sequence" : "Save changes"}
                </Button>
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        Cancel
                    </Button>
                )}
            </div>
        </form>
    );
}
