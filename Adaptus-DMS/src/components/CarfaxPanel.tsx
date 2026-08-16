"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    FileText,
    ExternalLink,
    Loader2,
    Upload,
    RefreshCw,
    AlertCircle,
    Link2,
} from "lucide-react";
import { apiFetch, ApiError } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { Button } from "@/src/components/ui/Button";

type CarfaxEnv = {
    upload_ready: boolean;
    partner_link_ready: boolean;
    api_fetch_ready: boolean;
    configured: boolean;
    status: string;
    missing: string[];
    notes: string;
};

type CarfaxReport = {
    id: string;
    report_url: string | null;
    vin: string;
    created_at: string;
    ownership_count?: number | null;
    accident_count?: number | null;
    title_status?: string | null;
};

interface CarfaxPanelProps {
    vehicleId: string;
    vin: string;
    carfaxReportUrl?: string | null;
    canEdit?: boolean;
    onAttached?: (url: string) => void;
}

export function CarfaxPanel({
    vehicleId,
    vin,
    carfaxReportUrl,
    canEdit = false,
    onAttached,
}: CarfaxPanelProps) {
    const [env, setEnv] = useState<CarfaxEnv | null>(null);
    const [reports, setReports] = useState<CarfaxReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch<{
                data: CarfaxReport[];
                env?: CarfaxEnv;
            }>(
                `/api/carfax?vehicle_id=${encodeURIComponent(vehicleId)}&status=1`,
                { silent: true }
            );
            setReports(res.data || []);
            if (res.env) setEnv(res.env);
        } catch {
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [vehicleId]);

    useEffect(() => {
        void load();
    }, [load]);

    const primaryUrl =
        carfaxReportUrl ||
        reports.find((r) => r.report_url)?.report_url ||
        null;

    async function handleFetch() {
        setFetching(true);
        try {
            const res = await apiFetch<{ data: CarfaxReport }>(`/api/carfax`, {
                method: "POST",
                body: {
                    action: "fetch",
                    vehicle_id: vehicleId,
                    vin,
                },
            });
            const url = res.data?.report_url;
            if (url) {
                onAttached?.(url);
                toast.success("CARFAX attached");
            }
            await load();
        } catch (err) {
            if (err instanceof ApiError && err.status === 503) {
                toast.error(
                    err.message ||
                        "Carfax auto-fetch not configured — upload a PDF instead"
                );
            } else {
                toast.error(
                    err instanceof Error ? err.message : "CARFAX fetch failed"
                );
            }
        } finally {
            setFetching(false);
        }
    }

    async function handleUpload(file: File | undefined) {
        if (!file) return;
        if (file.type !== "application/pdf") {
            toast.error("CARFAX must be a PDF");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File must be under 10MB");
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("vin", vin);
            const uploadRes = await fetch("/api/carfax/upload", {
                method: "POST",
                body: fd,
                credentials: "include",
            });
            const uploadBody = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) {
                throw new Error(
                    (uploadBody as { error?: string }).error ||
                        "CARFAX upload failed"
                );
            }
            const url = (uploadBody as { url?: string }).url;
            if (!url) throw new Error("Upload did not return a URL");

            await apiFetch("/api/carfax", {
                method: "POST",
                body: {
                    action: "attach",
                    vehicle_id: vehicleId,
                    vin,
                    report_url: url,
                },
            });
            onAttached?.(url);
            toast.success("CARFAX PDF attached");
            await load();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "CARFAX upload failed"
            );
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    const canAutoFetch = Boolean(
        env?.api_fetch_ready || env?.partner_link_ready
    );

    return (
        <section className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-[#2563EB]/10 p-2">
                        <FileText className="h-4 w-4 text-[#2563EB]" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            CARFAX
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {env?.notes ||
                                "Upload PDF or fetch when partner credentials are set"}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    onClick={() => void load()}
                    title="Refresh"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                </button>
            </div>

            {env && !canAutoFetch && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Auto-fetch needs{" "}
                        <code className="rounded bg-white/70 px-1">
                            CARFAX_PARTNER_ID
                        </code>{" "}
                        or{" "}
                        <code className="rounded bg-white/70 px-1">
                            CARFAX_API_KEY
                        </code>
                        +
                        <code className="rounded bg-white/70 px-1">
                            CARFAX_API_URL
                        </code>
                        . PDF upload still works.
                    </span>
                </div>
            )}

            {primaryUrl ? (
                <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 px-3 py-2 text-sm text-[#2563EB] hover:bg-[#2563EB]/10"
                >
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                        View report
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
            ) : (
                <p className="text-xs text-muted-foreground">
                    No report attached yet.
                </p>
            )}

            {canEdit && (
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) =>
                            void handleUpload(e.target.files?.[0])
                        }
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4" />
                        )}
                        Upload PDF
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={fetching || !canAutoFetch}
                        onClick={() => void handleFetch()}
                        title={
                            canAutoFetch
                                ? "Fetch / attach via partner"
                                : "Set Carfax env secrets first"
                        }
                    >
                        {fetching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        {env?.api_fetch_ready
                            ? "Fetch from API"
                            : "Attach VHR link"}
                    </Button>
                </div>
            )}

            {reports.length > 1 && (
                <p className="text-[11px] text-muted-foreground">
                    {reports.length} report records on file
                </p>
            )}
        </section>
    );
}
