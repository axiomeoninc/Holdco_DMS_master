"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, ShieldCheck, TrendingUp, TrendingDown } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";
import { AiNotConfiguredBanner } from "@/src/components/ai/AiNotConfiguredBanner";
import {
    extractLeadSignals,
    signalRows,
    type LeadExplanationInput,
} from "@/src/lib/business/lead-explainer";

type SignalView = {
    key: string;
    label: string;
    detail: string;
    positive: boolean;
    score_impact: number | null;
};

type Props = {
    leadId: string;
    /** Deterministic inputs — same shape lead-score uses. */
    input: LeadExplanationInput;
    persistedExplanation?: string | null;
};

/**
 * Why-this-lead panel: deterministic signal breakdown + LLM explanation
 * (draft-first). The explanation is generated server-side and filtered to
 * only the computed signals — the model cannot invent engagement facts.
 */
export function LeadScoreExplanation({
    leadId,
    input,
    persistedExplanation,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [missing, setMissing] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(
        persistedExplanation ?? null
    );
    const [action, setAction] = useState<string | null>(null);

    const signals = signalRows(extractLeadSignals(input));

    useEffect(() => {
        setExplanation(persistedExplanation ?? null);
    }, [persistedExplanation]);

    const generate = useCallback(async () => {
        setLoading(true);
        setMissing(false);
        try {
            const res = await apiFetch<{
                data: {
                    explanation: string;
                    action?: string;
                    signals: SignalView[];
                };
            }>("/api/ai/lead-explanation", {
                method: "POST",
                body: { lead_id: leadId },
                silent: true,
            });
            setExplanation(res.data.explanation);
            setAction(res.data.action ?? null);
            toast.success("Why-this-lead ready", "Review before acting on it.");
        } catch (err) {
            const status = (err as { status?: number }).status;
            if (status === 503) {
                setMissing(true);
                return;
            }
            toast.error(
                err instanceof Error ? err.message : "Explanation failed"
            );
        } finally {
            setLoading(false);
        }
    }, [leadId]);

    return (
        <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Why this lead
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void generate()}
                    disabled={loading}
                    leftIcon={
                        loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                        )
                    }
                >
                    {loading ? "Explaining…" : explanation ? "Regenerate" : "Generate why"}
                </Button>
            </div>

            {missing ? <AiNotConfiguredBanner compact /> : null}

            {/* Deterministic signal breakdown */}
            {signals.length > 0 && (
                <ul className="space-y-1.5">
                    {signals.map((s, i) => (
                        <li
                            key={i}
                            className="flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
                        >
                            {s.positive ? (
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                            ) : (
                                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <div>
                                <span className="font-medium text-foreground">
                                    {s.label}
                                </span>
                                {s.impact !== null && (
                                    <span
                                        className={`ml-1 tabular-nums ${
                                            s.positive
                                                ? "text-success"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        ({s.impact > 0 ? "+" : ""}
                                        {s.impact})
                                    </span>
                                )}
                                <span className="ml-1 text-muted-foreground">
                                    — {s.detail}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Honest empty/amber state — the panel surfaces even when no AI
                explanation has been generated or the lead has no computable
                signals. Never fabricates an explanation. */}
            {!loading && !missing && !explanation && signals.length > 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                    No AI explanation for this lead yet — generate one for a
                    plain-language summary of the signals below.
                </p>
            )}
            {!loading && !missing && signals.length === 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                    Not enough data to explain this lead&apos;s score.
                </p>
            )}

            {explanation ? (
                <div className="space-y-2">
                    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                        {explanation}
                    </div>
                    {action && (
                        <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                                Suggested next step:
                            </span>{" "}
                            {action}
                        </p>
                    )}
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />
                        AI explanation is restricted to the signals above — no
                        invented engagement facts.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
