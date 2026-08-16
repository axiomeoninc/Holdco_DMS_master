"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { AiNotConfiguredBanner } from "@/src/components/ai/AiNotConfiguredBanner";
import { formatDraftReadable } from "@/src/lib/ai/sanitize";
import { apiFetch, ApiError } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { cn } from "@/src/lib/utils";

type AiActionButtonProps = {
    label: string;
    endpoint: string;
    body?: Record<string, unknown>;
    method?: "POST" | "GET";
    onResult: (content: string, raw?: unknown) => void;
    className?: string;
    size?: "sm" | "md";
    variant?: "outline" | "ghost" | "secondary";
};

/**
 * Page-level Generate/Draft button. Surfaces amber banner on 503 not-configured.
 * Never toasts fake success. Strips leftover think tags before onResult.
 */
export function AiActionButton({
    label,
    endpoint,
    body,
    method = "POST",
    onResult,
    className,
    size = "sm",
    variant = "outline",
}: AiActionButtonProps) {
    const [loading, setLoading] = useState(false);
    const [missing, setMissing] = useState(false);

    async function run() {
        setLoading(true);
        setMissing(false);
        try {
            const res =
                method === "GET"
                    ? await apiFetch<{ data: { content?: string } }>(endpoint, {
                          silent: true,
                      })
                    : await apiFetch<{ data: { content?: string } }>(endpoint, {
                          method: "POST",
                          body: body ?? {},
                          silent: true,
                      });
            const raw = res?.data?.content;
            const content = formatDraftReadable(raw ?? "");
            if (!content) {
                toast.error("Flash AI returned an empty draft");
                return;
            }
            onResult(content, res.data);
            toast.success("Draft ready", "Review before saving or sending.");
        } catch (err) {
            if (err instanceof ApiError && err.status === 503) {
                setMissing(true);
                return;
            }
            toast.error(
                err instanceof Error ? err.message : "Flash AI request failed"
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Button
                type="button"
                variant={variant}
                size={size}
                onClick={() => void run()}
                disabled={loading}
                leftIcon={
                    loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                    )
                }
            >
                {loading ? "Generating…" : label}
            </Button>
            {missing ? <AiNotConfiguredBanner compact /> : null}
        </div>
    );
}
