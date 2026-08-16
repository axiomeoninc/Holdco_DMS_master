"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Save } from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

interface BusinessSettings {
    id: string;
    name: string;
    slug: string | null;
    business_name: string | null;
    business_address: string | null;
    business_phone: string | null;
    business_email: string | null;
    hst_number: string;
    dealer_license: string;
    autotrader_company_id: string;
    autotrader_category_id: string;
    email_from: string;
    display_name: string;
    can_edit: boolean;
}

export default function BusinessSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [form, setForm] = useState({
        name: "",
        business_name: "",
        business_address: "",
        business_phone: "",
        business_email: "",
        hst_number: "",
        dealer_license: "",
        autotrader_company_id: "",
        autotrader_category_id: "",
        email_from: "",
        display_name: "",
    });

    async function load() {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{ data: BusinessSettings }>(
                "/api/settings/business"
            );
            const d = res.data;
            setCanEdit(Boolean(d.can_edit));
            setForm({
                name: d.name || "",
                business_name: d.business_name || "",
                business_address: d.business_address || "",
                business_phone: d.business_phone || "",
                business_email: d.business_email || "",
                hst_number: d.hst_number || "",
                dealer_license: d.dealer_license || "",
                autotrader_company_id: d.autotrader_company_id || "",
                autotrader_category_id: d.autotrader_category_id || "",
                email_from: d.email_from || "",
                display_name: d.display_name || "",
            });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load settings"
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function save() {
        if (!canEdit) return;
        try {
            setSaving(true);
            await apiFetch("/api/settings/business", {
                method: "PATCH",
                body: form,
            });
            toast.success("Saved", "Business profile updated.");
            await load();
        } catch (err) {
            toast.error(
                "Save failed",
                err instanceof Error ? err.message : "Please try again."
            );
        } finally {
            setSaving(false);
        }
    }

    const fieldClass =
        "min-w-0 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60";

    return (
        <ListPageShell
            title="Business"
            description="Dealership name, address, phone, and tax identifiers for BOS and invoices"
            icon={Building2}
            breadcrumbs={[
                { label: "Settings", href: "/settings/business" },
                { label: "Business" },
            ]}
            actions={
                canEdit ? (
                    <Button size="sm" onClick={() => void save()} disabled={saving || loading}>
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save
                    </Button>
                ) : undefined
            }
        >
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : (
                <div className="min-w-0 space-y-4">
                    <div className="min-w-0 max-w-2xl space-y-4 rounded-lg border border-border bg-card p-5">
                    {!canEdit && (
                        <p className="text-sm text-muted-foreground">
                            View only — Admin/Manager or settings:write required to edit.
                        </p>
                    )}
                    <label className="block min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            Dealership name
                        </span>
                        <input
                            className={fieldClass}
                            disabled={!canEdit}
                            value={form.name}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, name: e.target.value }))
                            }
                        />
                    </label>
                    <label className="block min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            Legal / business name
                        </span>
                        <input
                            className={fieldClass}
                            disabled={!canEdit}
                            value={form.business_name}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    business_name: e.target.value,
                                }))
                            }
                        />
                    </label>
                    <label className="block min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            Address
                        </span>
                        <textarea
                            className={fieldClass}
                            rows={3}
                            disabled={!canEdit}
                            value={form.business_address}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    business_address: e.target.value,
                                }))
                            }
                        />
                    </label>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <label className="block min-w-0 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                Phone
                            </span>
                            <input
                                className={fieldClass}
                                disabled={!canEdit}
                                value={form.business_phone}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        business_phone: e.target.value,
                                    }))
                                }
                            />
                        </label>
                        <label className="block min-w-0 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                Email
                            </span>
                            <input
                                type="email"
                                className={fieldClass}
                                disabled={!canEdit}
                                value={form.business_email}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        business_email: e.target.value,
                                    }))
                                }
                            />
                        </label>
                    </div>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <label className="block min-w-0 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                HST number
                            </span>
                            <input
                                className={fieldClass}
                                disabled={!canEdit}
                                value={form.hst_number}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        hst_number: e.target.value,
                                    }))
                                }
                                placeholder="e.g. 123456789 RT0001"
                            />
                        </label>
                        <label className="block min-w-0 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                Dealer license
                            </span>
                            <input
                                className={fieldClass}
                                disabled={!canEdit}
                                value={form.dealer_license}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        dealer_license: e.target.value,
                                    }))
                                }
                            />
                        </label>
                    </div>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <label className="block min-w-0 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                AutoTrader Company ID
                            </span>
                            <input
                                className={fieldClass}
                                disabled={!canEdit}
                                value={form.autotrader_company_id}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        autotrader_company_id: e.target.value,
                                    }))
                                }
                                placeholder="From AutoTrader Location Services"
                            />
                        </label>
                        <label className="block min-w-0 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                AutoTrader Category ID
                            </span>
                            <input
                                className={fieldClass}
                                disabled={!canEdit}
                                value={form.autotrader_category_id}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        autotrader_category_id: e.target.value,
                                    }))
                                }
                                placeholder="Optional — from AT.ca"
                            />
                        </label>
                    </div>
                    </div>
                    <div className="min-w-0 max-w-2xl space-y-4 rounded-lg border border-border bg-card p-5">
                        <div className="space-y-1">
                            <span className="text-sm font-semibold">Email</span>
                            <p className="text-xs text-muted-foreground">
                                Sets the from-address used for emails sent on
                                behalf of this dealership — quotations, invoices,
                                CRM sequences, after-hours replies, staff invites.
                                Overrides the worker EMAIL_FROM for this dealership.
                            </p>
                        </div>
                        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                            <label className="block min-w-0 space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Outgoing email address (from)
                                </span>
                                <input
                                    className={fieldClass}
                                    disabled={!canEdit}
                                    value={form.email_from}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            email_from: e.target.value,
                                        }))
                                    }
                                    placeholder="dealer@example.com"
                                />
                            </label>
                            <label className="block min-w-0 space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Sender display name
                                </span>
                                <input
                                    className={fieldClass}
                                    disabled={!canEdit}
                                    value={form.display_name}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            display_name: e.target.value,
                                        }))
                                    }
                                    placeholder="Acme Motors"
                                />
                            </label>
                        </div>
                        <p className="overflow-x-auto text-xs text-muted-foreground">
                            Accepted formats:{" "}
                            <code className="whitespace-nowrap rounded bg-muted px-1 py-0.5">
                                dealer@example.com
                            </code>{" "}
                            or{" "}
                            <code className="whitespace-nowrap rounded bg-muted px-1 py-0.5">
                                Acme Motors &lt;dealer@example.com&gt;
                            </code>
                            . Leave blank to use the worker EMAIL_FROM.
                        </p>
                        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                            Sends still require RESEND_API_KEY in the Worker env
                            and a domain verified with Resend — until then, email
                            stays blocked and nothing is sent.
                        </p>
                    </div>
                </div>
            )}
        </ListPageShell>
    );
}
