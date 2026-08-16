"use client";

import { useState } from "react";
import { ClipboardCopy, Download, Share2, Loader2 } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";

interface KijijiListingPackProps {
    vehicleId: string;
    vin: string;
}

type Pack = {
    title: string;
    body_text: string;
    price_cad: number | null;
    image_urls: string[];
};

type Busy =
    | "copy"
    | "json"
    | "csv"
    | "at-feed"
    | "at-csv"
    | "at-check"
    | null;

export function KijijiListingPack({ vehicleId, vin }: KijijiListingPackProps) {
    const [busy, setBusy] = useState<Busy>(null);
    const [atIssues, setAtIssues] = useState<
        Array<{ field: string; message: string; severity: string }>
    >([]);

    const loadPack = async (): Promise<Pack> => {
        const res = await apiFetch<{ data: Pack }>(
            `/api/vehicles/${vehicleId}/syndication?board=kijiji&format=json`
        );
        if (!res.data) throw new Error("No listing pack returned");
        return res.data;
    };

    async function handleCopy() {
        setBusy("copy");
        try {
            const pack = await loadPack();
            await navigator.clipboard.writeText(pack.body_text);
            toast.success("Kijiji-ready text copied");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Copy failed"
            );
        } finally {
            setBusy(null);
        }
    }

    const downloadBlob = (content: string, filename: string, mime: string) => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    async function handleJson() {
        setBusy("json");
        try {
            const pack = await loadPack();
            downloadBlob(
                JSON.stringify(pack, null, 2),
                `kijiji-${vin}.json`,
                "application/json"
            );
            toast.success("JSON downloaded");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Export failed"
            );
        } finally {
            setBusy(null);
        }
    }

    async function handleCsv() {
        setBusy("csv");
        try {
            const res = await fetch(
                `/api/vehicles/${vehicleId}/syndication?board=kijiji&format=csv`,
                { credentials: "include" }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(
                    (body as { error?: string }).error || "CSV export failed"
                );
            }
            const text = await res.text();
            downloadBlob(text, `kijiji-${vin}.csv`, "text/csv");
            toast.success("CSV downloaded");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "CSV export failed"
            );
        } finally {
            setBusy(null);
        }
    }

    async function handleAutoTrader(format: "feed" | "csv") {
        setBusy(format === "feed" ? "at-feed" : "at-csv");
        setAtIssues([]);
        try {
            const res = await fetch(
                `/api/vehicles/${vehicleId}/syndication?board=autotrader&format=${format}`,
                { credentials: "include" }
            );
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    issues?: Array<{
                        field: string;
                        message: string;
                        severity: string;
                    }>;
                };
                if (body.issues?.length) setAtIssues(body.issues);
                throw new Error(
                    body.error || "AutoTrader export failed — check required fields"
                );
            }
            const text = await res.text();
            const ext = format === "feed" ? "txt" : "csv";
            const mime =
                format === "feed" ? "text/plain" : "text/csv";
            downloadBlob(text, `autotrader-ca-${vin}.${ext}`, mime);
            toast.success(
                format === "feed"
                    ? "AutoTrader.ca pipe feed downloaded"
                    : "AutoTrader.csv downloaded"
            );
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "AutoTrader export failed"
            );
        } finally {
            setBusy(null);
        }
    }

    async function handleAtCheck() {
        setBusy("at-check");
        setAtIssues([]);
        try {
            const res = await apiFetch<{
                meta: {
                    rows: Array<{
                        ok: boolean;
                        issues: Array<{
                            field: string;
                            message: string;
                            severity: string;
                        }>;
                    }>;
                };
            }>(
                `/api/vehicles/${vehicleId}/syndication?board=autotrader&format=json`
            );
            const row = res.meta?.rows?.[0];
            const issues = row?.issues || [];
            setAtIssues(issues);
            if (row?.ok) {
                toast.success("Ready for AutoTrader feed export");
            } else {
                toast.error("Fix required fields before download");
            }
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Validation failed"
            );
        } finally {
            setBusy(null);
        }
    }

    return (
        <section className="rounded-xl border border-border bg-card p-3.5 space-y-4">
            <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[#2563EB]/10 p-2">
                    <Share2 className="h-4 w-4 text-[#2563EB]" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">
                        Marketplace syndication
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Export / feed download — not live auto-post
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Kijiji pack</p>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleCopy()}
                    >
                        {busy === "copy" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ClipboardCopy className="h-4 w-4" />
                        )}
                        Copy text
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleJson()}
                    >
                        {busy === "json" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        JSON
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleCsv()}
                    >
                        {busy === "csv" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        CSV
                    </Button>
                </div>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-foreground">
                    AutoTrader Canada feed
                </p>
                <p className="text-xs text-muted-foreground">
                    Pipe-delimited AT.ca field set for partner upload / HomeNet.
                    Requires VIN, price, photos, year/make/model.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleAutoTrader("feed")}
                    >
                        {busy === "at-feed" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Pipe feed
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleAutoTrader("csv")}
                    >
                        {busy === "at-csv" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        AT CSV
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleAtCheck()}
                    >
                        {busy === "at-check" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Check fields
                    </Button>
                </div>
                {atIssues.length > 0 && (
                    <ul className="mt-1 space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                        {atIssues.map((issue) => (
                            <li
                                key={`${issue.field}-${issue.message}`}
                                className={
                                    issue.severity === "error"
                                        ? "text-destructive"
                                        : "text-amber-700 dark:text-amber-400"
                                }
                            >
                                <span className="font-medium">{issue.field}:</span>{" "}
                                {issue.message}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
