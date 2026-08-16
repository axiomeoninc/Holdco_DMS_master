"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Share2,
    Plus,
    RefreshCw,
    Loader2,
    AlertCircle,
    Car,
    Link2,
    Unlink,
    Sparkles,
    ImageIcon,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { FilterChip, FilterChipGroup } from "@/src/components/ui/FilterChip";
import { SkeletonTable } from "@/src/components/ui/Skeleton";

interface SocialPost {
    id: string;
    platform: string;
    content: string;
    media_urls: string[] | null;
    scheduled_date: string | null;
    published_date: string | null;
    status: string;
    notes: string | null;
    vehicle_id?: string | null;
    created_at: string;
}

interface VehicleOption {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    retail_price: number | null;
    image_gallery: string[] | null;
    status: string;
    stock_number?: string | null;
}

interface FbStatus {
    connected?: boolean;
    has_token?: boolean;
    account_name?: string;
    page_name?: string | null;
    is_active?: boolean;
}

type StatusFilter = "" | "Draft" | "Scheduled" | "Published" | "Failed";

function galleryPreview(v: VehicleOption | undefined): string[] {
    if (!v?.image_gallery) return [];
    return v.image_gallery.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 4);
}

export default function SocialPage() {
    return (
        <Suspense fallback={<SkeletonTable rows={6} />}>
            <SocialPageInner />
        </Suspense>
    );
}

function SocialPageInner() {
    const searchParams = useSearchParams();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fb, setFb] = useState<FbStatus>({ connected: false });
    const [oauthReady, setOauthReady] = useState(false);
    const [missingEnv, setMissingEnv] = useState<string[]>([]);
    const [fbMessage, setFbMessage] = useState<string | null>(null);
    const [fbBusy, setFbBusy] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

    const [showPost, setShowPost] = useState(false);
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [vehicleId, setVehicleId] = useState("");
    const [content, setContent] = useState("");
    const [platform, setPlatform] = useState("Facebook");
    const [mode, setMode] = useState<"draft" | "schedule" | "publish">("draft");
    const [scheduledAt, setScheduledAt] = useState("");
    const [saving, setSaving] = useState(false);
    const [captionBusy, setCaptionBusy] = useState(false);
    const [aiAvailable, setAiAvailable] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const statusQs = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : "";
            const [postsRes, fbRes] = await Promise.all([
                apiFetch<{ data: SocialPost[] }>(`/api/social/posts?limit=100${statusQs}`),
                apiFetch<{
                    data: FbStatus;
                    oauth_ready?: boolean;
                    missing_env?: string[];
                    message?: string;
                }>("/api/social/facebook", { silent: true }),
            ]);
            setPosts(postsRes.data || []);
            setFb(fbRes.data || { connected: false });
            setOauthReady(Boolean(fbRes.oauth_ready));
            setMissingEnv(fbRes.missing_env || []);
            setFbMessage(fbRes.message || null);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load social");
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const fbParam = searchParams.get("fb");
        if (fbParam === "connected") {
            toast.success(`Facebook connected${searchParams.get("page") ? `: ${searchParams.get("page")}` : ""}`);
            void load();
        } else if (fbParam === "error") {
            toast.error(searchParams.get("message") || "Facebook connect failed");
        }
    }, [searchParams, load]);

    const counts = useMemo(() => {
        const all = posts;
        // When filtered, metrics reflect loaded page; reload without filter for true totals would be extra call — keep simple
        return {
            total: all.length,
            draft: all.filter((p) => p.status === "Draft").length,
            scheduled: all.filter((p) => p.status === "Scheduled").length,
            published: all.filter((p) => p.status === "Published").length,
        };
    }, [posts]);

    const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
    const mediaPreview = galleryPreview(selectedVehicle);

    async function openPostModal() {
        setFormError(null);
        setContent("");
        setVehicleId("");
        setMode("draft");
        setScheduledAt("");
        setPlatform("Facebook");
        setShowPost(true);
        try {
            const res = await apiFetch<{ data: VehicleOption[] }>(
                "/api/vehicles?limit=100&status=Active"
            );
            setVehicles(res.data || []);
        } catch {
            setVehicles([]);
        }
    }

    async function onVehiclePick(id: string) {
        setVehicleId(id);
        if (!id) {
            setContent("");
            return;
        }
        setCaptionBusy(true);
        try {
            const res = await apiFetch<{
                data: { content: string; source: string; ai_available: boolean };
            }>("/api/social/caption", {
                method: "POST",
                body: { vehicle_id: id, ai: true },
            });
            setContent(res.data.content);
            setAiAvailable(Boolean(res.data.ai_available));
            if (res.data.source === "openai") {
                toast.success("AI caption ready — edit before posting");
            }
        } catch {
            const v = vehicles.find((x) => x.id === id);
            if (v) {
                const price =
                    v.retail_price != null
                        ? new Intl.NumberFormat("en-CA", {
                              style: "currency",
                              currency: "CAD",
                              maximumFractionDigits: 0,
                          }).format(Number(v.retail_price))
                        : null;
                setContent(
                    [`${v.year} ${v.make} ${v.model}`, price ? `Asking ${price} + taxes` : null, `Stock / VIN: ${v.vin}`, "", "Message us for a test drive or more details."]
                        .filter(Boolean)
                        .join("\n")
                );
            }
        } finally {
            setCaptionBusy(false);
        }
    }

    async function regenerateCaption() {
        if (!vehicleId) return;
        setCaptionBusy(true);
        try {
            const res = await apiFetch<{
                data: { content: string; source: string; ai_available: boolean };
            }>("/api/social/caption", {
                method: "POST",
                body: { vehicle_id: vehicleId, ai: true },
            });
            setContent(res.data.content);
            setAiAvailable(Boolean(res.data.ai_available));
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Caption failed");
        } finally {
            setCaptionBusy(false);
        }
    }

    async function onSavePost() {
        if (!content.trim()) {
            setFormError("Post content is required");
            return;
        }
        if (mode === "schedule" && !scheduledAt) {
            setFormError("Pick a schedule date/time");
            return;
        }
        if (mode === "publish") {
            if (platform !== "Facebook") {
                setFormError(
                    "Live publish is Facebook Page only — switch platform to Facebook or save as Draft."
                );
                return;
            }
            if (!fb.connected) {
                setFormError(
                    "Connect Facebook Page first (needs FACEBOOK_APP_ID/SECRET). You can still save a Draft."
                );
                return;
            }
        }
        setSaving(true);
        setFormError(null);
        try {
            const publishNow = mode === "publish" && platform === "Facebook" && Boolean(fb.connected);
            const body: Record<string, unknown> = {
                platform,
                content: content.trim(),
                vehicle_id: vehicleId || null,
                media_urls: mediaPreview.length ? mediaPreview : undefined,
                publish_now: publishNow,
                // Never send Published without publish_now — API also guards Graph post_id
                status: publishNow ? "Draft" : mode === "schedule" ? "Scheduled" : "Draft",
                scheduled_date: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
            };
            const res = await apiFetch<{
                data: SocialPost;
                published?: boolean;
                message?: string;
            }>("/api/social/posts", { method: "POST", body });
            if (res.published) {
                toast.success("Published to Facebook Page");
            } else if (mode === "schedule") {
                toast.success("Scheduled — cron or manual publish-scheduled will post when due");
            } else if (res.message) {
                toast.success(res.message);
            } else {
                toast.success("Draft saved");
            }
            setShowPost(false);
            await load();
        } catch (e: unknown) {
            setFormError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function toggleFb() {
        setFbBusy(true);
        try {
            if (fb.connected) {
                await apiFetch("/api/social/facebook", {
                    method: "POST",
                    body: { action: "disconnect" },
                });
                toast.success("Facebook disconnected");
                await load();
            } else {
                if (!oauthReady) {
                    toast.error(
                        `Connect requires env: ${(missingEnv.length ? missingEnv : ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"]).join(", ")}`
                    );
                    return;
                }
                const res = await apiFetch<{ data: { oauth_url: string } }>("/api/social/facebook", {
                    method: "POST",
                    body: { action: "oauth_start" },
                });
                if (res.data?.oauth_url) {
                    window.location.href = res.data.oauth_url;
                    return;
                }
                toast.error("No OAuth URL returned");
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Facebook action failed");
        } finally {
            setFbBusy(false);
        }
    }

    return (
        <ListPageShell
            title="Social Posting"
            description="Draft, schedule, or publish Page posts from inventory photos. Meta Graph only — no Marketplace bots."
            icon={Share2}
            breadcrumbs={[{ label: "Marketing" }, { label: "Social" }]}
            actions={
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => void openPostModal()}>
                        <Plus className="h-4 w-4" />
                        Post from vehicle
                    </Button>
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Loaded", value: counts.total, format: "number" },
                        { label: "Drafts", value: counts.draft, format: "number", tone: "cold" },
                        {
                            label: "Scheduled",
                            value: counts.scheduled,
                            format: "number",
                            tone: "warm",
                        },
                        {
                            label: "Published",
                            value: counts.published,
                            format: "number",
                            tone: "success",
                        },
                    ]}
                />
            }
            toolbar={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FilterChipGroup aria-label="Post status">
                        {(
                            [
                                ["", "All"],
                                ["Draft", "Draft"],
                                ["Scheduled", "Scheduled"],
                                ["Published", "Published"],
                                ["Failed", "Failed"],
                            ] as const
                        ).map(([value, label]) => (
                            <FilterChip
                                key={value || "all"}
                                selected={statusFilter === value}
                                onClick={() => setStatusFilter(value)}
                            >
                                {label}
                            </FilterChip>
                        ))}
                    </FilterChipGroup>

                    <div
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${
                            fb.connected
                                ? "border-border bg-card"
                                : oauthReady
                                  ? "border-border bg-card"
                                  : "border-amber-200 bg-amber-50"
                        }`}
                    >
                        <div className="min-w-0">
                            <div
                                className={`text-sm font-medium ${
                                    !fb.connected && !oauthReady
                                        ? "text-amber-950"
                                        : "text-foreground"
                                }`}
                            >
                                Facebook Page
                            </div>
                            <div
                                className={`text-xs ${
                                    !fb.connected && !oauthReady
                                        ? "text-amber-900/90"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {fb.connected
                                    ? `${fb.page_name || fb.account_name || "Connected"} · Graph publish ready`
                                    : oauthReady
                                      ? "Not connected — connect a Page to publish"
                                      : fbMessage ||
                                        "Not configured — add via wrangler when ready (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET). Drafts still work."}
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={() => void toggleFb()}
                            disabled={fbBusy || (!fb.connected && !oauthReady)}
                            title={
                                !fb.connected && !oauthReady
                                    ? "Not configured — add FACEBOOK_APP_ID / FACEBOOK_APP_SECRET via wrangler when ready"
                                    : undefined
                            }
                        >
                            {fbBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : fb.connected ? (
                                <Unlink className="h-4 w-4" />
                            ) : (
                                <Link2 className="h-4 w-4" />
                            )}
                            {fb.connected
                                ? "Disconnect"
                                : oauthReady
                                  ? "Connect Page"
                                  : "Not configured"}
                        </Button>
                    </div>
                </div>
            }
        >
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {loading ? (
                <SkeletonTable rows={6} />
            ) : posts.length === 0 ? (
                <EmptyState
                    icon={Share2}
                    title="No social posts yet"
                    description="Create a draft from an inventory vehicle. Gallery images are reused — nothing is scraped."
                    action={{
                        label: "Post from vehicle",
                        icon: Plus,
                        onClick: () => void openPostModal(),
                    }}
                />
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3">Platform</th>
                                <th className="px-4 py-3">Content</th>
                                <th className="px-4 py-3">Media</th>
                                <th className="px-4 py-3">Schedule</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {posts.map((p) => (
                                <tr key={p.id} className="hover:bg-muted/30">
                                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                        {new Date(p.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-foreground">{p.platform}</td>
                                    <td className="max-w-md px-4 py-3">
                                        <p className="line-clamp-3 whitespace-pre-wrap text-foreground/90">
                                            {p.content}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {p.media_urls?.length ? (
                                            <span className="inline-flex items-center gap-1">
                                                <ImageIcon className="h-3.5 w-3.5" />
                                                {p.media_urls.length}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                        {p.scheduled_date
                                            ? new Date(p.scheduled_date).toLocaleString()
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={p.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ModalShell
                open={showPost}
                onClose={() => !saving && setShowPost(false)}
                title="Post from vehicle"
                description="Uses existing gallery images. Caption is editable. Publish requires a connected Facebook Page token."
                size="xl"
                error={formError}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowPost(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={() => void onSavePost()} disabled={saving || captionBusy}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {mode === "publish"
                                ? "Publish to Page"
                                : mode === "schedule"
                                  ? "Save schedule"
                                  : "Save draft"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Vehicle</span>
                        <div className="relative">
                            <Car className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <select
                                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
                                value={vehicleId}
                                onChange={(e) => void onVehiclePick(e.target.value)}
                            >
                                <option value="">Select vehicle…</option>
                                {vehicles.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.year} {v.make} {v.model} · {v.vin}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </label>

                    {mediaPreview.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                Gallery images (existing — up to 4)
                            </span>
                            <div className="flex gap-2 overflow-x-auto">
                                {mediaPreview.map((url) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={url}
                                        src={url}
                                        alt=""
                                        className="h-16 w-24 shrink-0 rounded-md border border-border object-cover"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Platform</span>
                        <select
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            value={platform}
                            onChange={(e) => {
                                const next = e.target.value;
                                setPlatform(next);
                                if (next !== "Facebook" && mode === "publish") {
                                    setMode("draft");
                                }
                            }}
                        >
                            <option>Facebook</option>
                            <option>Instagram</option>
                            <option>Twitter</option>
                            <option>LinkedIn</option>
                        </select>
                        {platform !== "Facebook" && (
                            <p className="text-xs text-muted-foreground">
                                Live publish is Facebook Page only in Social v1; other platforms save as draft.
                            </p>
                        )}
                    </label>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Caption *</span>
                            <Button
                                type="button"
                                variant="secondary"
                                className="h-8 px-2 text-xs"
                                disabled={!vehicleId || captionBusy}
                                onClick={() => void regenerateCaption()}
                            >
                                {captionBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Sparkles className="h-3.5 w-3.5" />
                                )}
                                {aiAvailable ? "Regenerate AI" : "Template caption"}
                            </Button>
                        </div>
                        <textarea
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            rows={8}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {aiAvailable
                                ? "OPENAI_API_KEY detected — AI caption optional; always edit before publish."
                                : "No OPENAI_API_KEY — using YMM/price template."}
                        </p>
                    </div>

                    <fieldset className="space-y-4">
                        <legend className="text-xs font-medium text-muted-foreground">Action</legend>
                        <FilterChipGroup aria-label="Post action">
                            <FilterChip selected={mode === "draft"} onClick={() => setMode("draft")}>
                                Draft
                            </FilterChip>
                            <FilterChip
                                selected={mode === "schedule"}
                                onClick={() => setMode("schedule")}
                            >
                                Schedule
                            </FilterChip>
                            <FilterChip
                                selected={mode === "publish"}
                                onClick={() => setMode("publish")}
                                disabled={!fb.connected || platform !== "Facebook"}
                                title={
                                    platform !== "Facebook"
                                        ? "Live publish is Facebook Page only"
                                        : fb.connected
                                          ? "Publish now via Graph API"
                                          : "Connect Facebook Page first"
                                }
                            >
                                Publish to Page
                            </FilterChip>
                        </FilterChipGroup>
                        {mode === "schedule" && (
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Scheduled at
                                </span>
                                <input
                                    type="datetime-local"
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                    value={scheduledAt}
                                    onChange={(e) => setScheduledAt(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Stores scheduled_date. Hourly CF cron publishes when SOCIAL_CRON_SECRET is
                                    set; otherwise publish manually via /api/social/publish-scheduled.
                                    Live cron returns 503 until secret is set — no fake publish.
                                </p>
                            </label>
                        )}
                        {(mode === "publish" && (!fb.connected || platform !== "Facebook")) && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                                {platform !== "Facebook"
                                    ? "Live publish is Facebook Page only in Social v1 — switch to Facebook or save as Draft."
                                    : "Not configured / not connected — add FACEBOOK_APP_ID/SECRET via wrangler when ready, then Connect Page. You can still save a draft."}
                            </p>
                        )}
                    </fieldset>
                </div>
            </ModalShell>
        </ListPageShell>
    );
}
