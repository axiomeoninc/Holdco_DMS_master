"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { AiNotConfiguredBanner } from "@/src/components/ai/AiNotConfiguredBanner";
import { ApiError } from "@/src/lib/fetch";

type BriefData = {
    content: string;
    snapshot?: { open_leads?: number; hot_leads?: number; aging_count?: number };
    generated_at?: string;
};

export function DeskBriefWidget() {
    const [data, setData] = useState<BriefData | null>(null);
    const [loading, setLoading] = useState(false);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMissing(false);
        try {
            const res = await fetch("/api/ai/desk-brief", {
                credentials: "include",
            });
            if (res.status === 503) {
                setMissing(true);
                setData(null);
                return;
            }
            const json = (await res.json()) as {
                data?: BriefData;
                error?: string;
            };
            if (!res.ok) {
                throw new ApiError(res.status, json.error || "Failed", json);
            }
            if (!json.data?.content) {
                setError("Empty brief");
                return;
            }
            setData(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Desk brief failed");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="border-b border-border/60 bg-transparent py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <div>
                            <CardTitle className="text-base">Daily desk brief</CardTitle>
                            <CardDescription>
                                Flash AI · aging, leads, follow-ups
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void load()}
                        disabled={loading}
                        aria-label="Refresh desk brief"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
                {missing ? <AiNotConfiguredBanner compact /> : null}
                {error && !missing ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : null}
                {data?.snapshot ? (
                    <p className="text-xs text-muted-foreground">
                        Open leads {data.snapshot.open_leads ?? "—"} · Hot{" "}
                        {data.snapshot.hot_leads ?? "—"} · Aging 45d+{" "}
                        {data.snapshot.aging_count ?? "—"}
                    </p>
                ) : null}
                {loading && !data ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating brief…
                    </div>
                ) : null}
                {data?.content ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                        {data.content}
                    </pre>
                ) : null}
            </CardContent>
        </Card>
    );
}
