"use client";

import { useEffect, useState } from "react";
import { Code2, Copy, RefreshCw, Check, Globe, AlertCircle, Loader2 } from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

interface EmbedSettings {
    dealership_id: string;
    dealership_name: string;
    slug: string | null;
    embed_token: string;
    embed_vdp_base: string | null;
    embed_token_required: boolean;
    snippet: string;
    iframe_snippet: string;
    showroom_url: string | null;
    api_url: string;
    wordpress_note: string;
    message?: string;
}

export default function WebsiteEmbedSettingsPage() {
    const [data, setData] = useState<EmbedSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rotating, setRotating] = useState(false);
    const [copied, setCopied] = useState<"script" | "iframe" | "showroom" | null>(null);
    const [vdpBase, setVdpBase] = useState("");
    const [tokenRequired, setTokenRequired] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [snippetKind, setSnippetKind] = useState<"script" | "iframe">("script");

    async function load() {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{ data: EmbedSettings }>("/api/embed/settings");
            setData(res.data);
            setVdpBase(res.data.embed_vdp_base || "");
            setTokenRequired(res.data.embed_token_required);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load embed settings");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    useEffect(() => {
        function onMsg(event: MessageEvent) {
            const payload = event.data as { type?: string; height?: number } | null;
            if (!payload || payload.type !== "flashfender-embed-height") return;
            if (typeof payload.height !== "number") return;
            const frame = document.querySelector<HTMLIFrameElement>(
                'iframe[title="Inventory preview"]'
            );
            if (frame) {
                frame.style.height = `${Math.max(payload.height, 320)}px`;
            }
        }
        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []);

    async function copyText(text: string, kind: "script" | "iframe" | "showroom") {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(kind);
            toast.success("Copied", "Paste this on your dealership website.");
            setTimeout(() => setCopied(null), 2000);
        } catch {
            toast.error("Copy failed", "Select the snippet and copy manually.");
        }
    }

    async function rotateToken() {
        try {
            setRotating(true);
            const res = await apiFetch<{ data: EmbedSettings }>(
                "/api/embed/settings",
                {
                    method: "POST",
                    body: {
                        action: "rotate",
                        embed_vdp_base: vdpBase,
                        embed_token_required: tokenRequired,
                    },
                }
            );
            setData((prev) => (prev ? { ...prev, ...res.data } : res.data));
            toast.success("Token rotated", res.data.message || "Update pasted snippets on your site.");
            await load();
        } catch (err) {
            toast.error("Rotate failed", err instanceof Error ? err.message : "Try again");
        } finally {
            setRotating(false);
        }
    }

    async function saveSettings(next?: { tokenRequired?: boolean }) {
        try {
            setSaving(true);
            const requireToken = next?.tokenRequired ?? tokenRequired;
            const res = await apiFetch<{ data: EmbedSettings }>(
                "/api/embed/settings",
                {
                    method: "POST",
                    body: {
                        embed_vdp_base: vdpBase,
                        embed_token_required: requireToken,
                    },
                }
            );
            setData((prev) => (prev ? { ...prev, ...res.data } : res.data));
            setTokenRequired(res.data.embed_token_required);
            toast.success("Saved", "Embed settings updated.");
        } catch (err) {
            toast.error("Save failed", err instanceof Error ? err.message : "Try again");
        } finally {
            setSaving(false);
        }
    }

    const snippet = snippetKind === "iframe" ? data?.iframe_snippet : data?.snippet;

    return (
        <ListPageShell
            title="Website inventory embed"
            description="Drop-in widget for any dealership website. Shows only this rooftop’s Active vehicles."
            icon={Globe}
            actions={
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </Button>
            }
        >
            {loading ? (
                <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading embed settings…
                </div>
            ) : error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-medium">Could not load embed settings</p>
                        <p className="mt-0.5 text-destructive/80">{error}</p>
                        <p className="mt-2 text-muted-foreground">
                            Dealership Admin/Manager or platform admin access is required.
                        </p>
                    </div>
                </div>
            ) : data ? (
                <div className="mx-auto max-w-3xl space-y-6">
                    <section className="space-y-3 border-b border-border pb-6">
                        <h2 className="text-sm font-semibold tracking-tight text-foreground">
                            {data.dealership_name}
                        </h2>
                        <p className="text-[13px] text-muted-foreground">
                            Public API returns only{" "}
                            <span className="font-medium text-foreground">Active</span> vehicles
                            for this dealership. Other tenants are never included. Card clicks open
                            the FlashFender hosted vehicle page unless you set a custom VDP URL
                            below.
                        </p>
                        <dl className="grid min-w-0 gap-2 text-[13px] sm:grid-cols-2">
                            <div className="min-w-0">
                                <dt className="text-muted-foreground">Dealership ID</dt>
                                <dd className="truncate font-mono text-xs text-foreground">
                                    {data.dealership_id}
                                </dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-muted-foreground">Embed token</dt>
                                <dd className="truncate font-mono text-xs text-foreground">
                                    {data.embed_token}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section className="space-y-3 border-b border-border pb-6">
                        <h2 className="text-sm font-semibold tracking-tight">Live preview</h2>
                        <p className="text-[13px] text-muted-foreground">
                            Same widget a customer sees on your site (this rooftop only).
                        </p>
                        <iframe
                            title="Inventory preview"
                            src={`/embed/inventory?token=${encodeURIComponent(data.embed_token)}&dealership_id=${encodeURIComponent(data.dealership_id)}&limit=8`}
                            className="min-h-[20rem] w-full rounded-lg border border-border bg-transparent"
                        />
                    </section>

                    <section className="space-y-3 border-b border-border pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                                <Code2 className="h-4 w-4 text-muted-foreground" />
                                Embed snippet
                            </h2>
                            <div className="flex gap-2">
                                <Button
                                    variant={snippetKind === "script" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSnippetKind("script")}
                                >
                                    Script
                                </Button>
                                <Button
                                    variant={snippetKind === "iframe" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSnippetKind("iframe")}
                                >
                                    Iframe
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        void copyText(
                                            snippet || "",
                                            snippetKind === "iframe" ? "iframe" : "script"
                                        )
                                    }
                                >
                                    {copied === snippetKind ? (
                                        <Check className="h-3.5 w-3.5" />
                                    ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                    )}
                                    {copied === snippetKind ? "Copied" : "Copy"}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void rotateToken()}
                                    disabled={rotating}
                                    loading={rotating}
                                >
                                    Rotate token
                                </Button>
                            </div>
                        </div>
                        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-[12px] leading-relaxed text-foreground">
                            {snippet}
                        </pre>
                        <p className="text-[13px] text-muted-foreground">{data.wordpress_note}</p>
                        <p className="text-[13px] text-muted-foreground">
                            Default click-through is{" "}
                            <code className="rounded bg-muted px-1 text-xs">
                                /embed/vehicles/&#123;id&#125;
                            </code>
                            . Use iframe when the CMS blocks third-party scripts.
                        </p>
                    </section>

                    <section className="space-y-3 border-b border-border pb-6">
                        <h2 className="text-sm font-semibold tracking-tight">Hosted showroom</h2>
                        {data.showroom_url ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px]">
                                    {data.showroom_url}
                                </code>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void copyText(data.showroom_url || "", "showroom")}
                                >
                                    {copied === "showroom" ? "Copied" : "Copy URL"}
                                </Button>
                            </div>
                        ) : (
                            <p className="text-[13px] text-muted-foreground">
                                No public slug yet — set a showroom slug in business settings to
                                get a branded FlashFender page.
                            </p>
                        )}
                    </section>

                    <section className="space-y-3 border-b border-border pb-6">
                        <h2 className="text-sm font-semibold tracking-tight">
                            Vehicle detail page base URL
                        </h2>
                        <p className="text-[13px] text-muted-foreground">
                            Optional. When set, card clicks open{" "}
                            <code className="rounded bg-muted px-1 text-xs">
                                base/&#123;vehicleId&#125;
                            </code>{" "}
                            on your site instead of the hosted VDP.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                type="url"
                                value={vdpBase}
                                onChange={(e) => setVdpBase(e.target.value)}
                                placeholder="https://yoursite.com/inventory"
                                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <Button
                                size="sm"
                                onClick={() => void saveSettings()}
                                disabled={saving}
                                loading={saving}
                            >
                                Save
                            </Button>
                        </div>
                        <label className="flex items-start gap-2 text-[13px] text-foreground">
                            <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={tokenRequired}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    setTokenRequired(next);
                                    void saveSettings({ tokenRequired: next });
                                }}
                            />
                            <span>
                                Require embed token —{" "}
                                <span className="text-muted-foreground">
                                    id or slug alone cannot list inventory without the token from
                                    this snippet.
                                </span>
                            </span>
                        </label>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-sm font-semibold tracking-tight">JSON API</h2>
                        <p className="break-all font-mono text-[11px] text-muted-foreground">
                            {data.api_url}
                        </p>
                    </section>
                </div>
            ) : null}
        </ListPageShell>
    );
}
