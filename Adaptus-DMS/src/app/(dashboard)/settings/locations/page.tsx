"use client";

import { useEffect, useState } from "react";
import {
    Building2,
    Loader2,
    Plus,
    MapPin,
    Star,
    Trash2,
    RefreshCw,
    AlertCircle,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";

type Location = {
    id: string;
    dealership_id: string;
    name: string;
    code: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    is_active: boolean;
    is_primary: boolean;
    hours: string | null;
};

type LocationForm = {
    name: string;
    code: string;
    address: string;
    phone: string;
    email: string;
    hours: string;
};

const EMPTY_FORM: LocationForm = {
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    hours: "",
};

export default function LocationsSettingsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [canEdit, setCanEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    async function load() {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{ data: Location[]; can_edit: boolean }>(
                "/api/settings/locations?include_inactive=1"
            );
            setLocations(res.data || []);
            setCanEdit(res.can_edit === true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load locations");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function createLocation() {
        if (!form.name.trim()) {
            toast.error("Name required", "Give the location a name.");
            return;
        }
        try {
            setSaving(true);
            const res = await apiFetch<{ data: Location }>("/api/settings/locations", {
                method: "POST",
                body: { ...form, name: form.name.trim() },
            });
            setLocations((prev) => [...prev, res.data]);
            setShowForm(false);
            setForm(EMPTY_FORM);
            toast.success("Location added", `${res.data.name} was created.`);
        } catch (err) {
            toast.error("Create failed", err instanceof Error ? err.message : "Try again");
        } finally {
            setSaving(false);
        }
    }

    async function setPrimary(id: string) {
        try {
            const res = await apiFetch<{ data: Location }>("/api/settings/locations", {
                method: "PATCH",
                body: { id, set_primary: true },
            });
            setLocations((prev) =>
                prev.map((l) => ({
                    ...l,
                    is_primary: l.id === res.data.id,
                }))
            );
            toast.success("Primary updated", `${res.data.name} is now the primary location.`);
        } catch (err) {
            toast.error("Update failed", err instanceof Error ? err.message : "Try again");
        }
    }

    async function toggleActive(loc: Location) {
        try {
            const res = await apiFetch<{ data: Location }>("/api/settings/locations", {
                method: "PATCH",
                body: { id: loc.id, is_active: !loc.is_active },
            });
            setLocations((prev) => prev.map((l) => (l.id === loc.id ? res.data : l)));
            toast.success(
                res.data.is_active ? "Location enabled" : "Location disabled",
                res.data.name
            );
        } catch (err) {
            toast.error("Update failed", err instanceof Error ? err.message : "Try again");
        }
    }

    async function removeLocation(id: string, name: string) {
        if (!window.confirm(`Delete "${name}"? Existing inventory/deals/leads keep their data (location becomes unassigned).`)) {
            return;
        }
        try {
            await apiFetch(`/api/settings/locations?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            setLocations((prev) => prev.filter((l) => l.id !== id));
            toast.success("Location deleted", name);
        } catch (err) {
            toast.error("Delete failed", err instanceof Error ? err.message : "Try again");
        }
    }

    return (
        <ListPageShell
            title="Locations"
            description="Run multiple rooftops under one dealership. Assign inventory, deals, and leads to a location — records without a location stay unassigned (legacy single-location behavior is unchanged)."
            icon={Building2}
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    {canEdit && (
                        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                            <Plus className="h-3.5 w-3.5" />
                            Add location
                        </Button>
                    )}
                </div>
            }
        >
            {loading ? (
                <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading locations…
                </div>
            ) : error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-medium">Could not load locations</p>
                        <p className="mt-0.5 text-destructive/80">{error}</p>
                    </div>
                </div>
            ) : (
                <div className="mx-auto max-w-3xl space-y-6">
                    {!canEdit && (
                        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
                            You can view locations. Admin or Manager access is required to add or
                            edit them.
                        </p>
                    )}

                    {showForm && (
                        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                            <h2 className="text-sm font-semibold tracking-tight">New location</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Name *</span>
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Downtown store"
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </label>
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Code</span>
                                    <input
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        placeholder="DT-01"
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </label>
                                <label className="block space-y-1 text-xs sm:col-span-2">
                                    <span className="font-medium text-muted-foreground">Address</span>
                                    <input
                                        value={form.address}
                                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        placeholder="123 Main St, Toronto ON"
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </label>
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Phone</span>
                                    <input
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="(416) 555-0100"
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </label>
                                <label className="block space-y-1 text-xs">
                                    <span className="font-medium text-muted-foreground">Email</span>
                                    <input
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="downtown@dealership.com"
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </label>
                                <label className="block space-y-1 text-xs sm:col-span-2">
                                    <span className="font-medium text-muted-foreground">Hours</span>
                                    <input
                                        value={form.hours}
                                        onChange={(e) => setForm({ ...form, hours: e.target.value })}
                                        placeholder="Mon–Sat 9:00–18:00"
                                        className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={() => void createLocation()} disabled={saving} loading={saving}>
                                    Save location
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </section>
                    )}

                    {locations.length === 0 && !showForm ? (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            <MapPin className="mx-auto mb-2 h-6 w-6" />
                            No locations yet. Everything currently runs as a single dealership —
                            add a location to scope inventory, deals, and leads by rooftop.
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {locations.map((loc) => (
                                <li
                                    key={loc.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold">{loc.name}</p>
                                            {loc.is_primary && (
                                                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                                    <Star className="h-2.5 w-2.5" />
                                                    Primary
                                                </span>
                                            )}
                                            {!loc.is_active && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                                    Disabled
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                            {[loc.code, loc.address].filter(Boolean).join(" · ") ||
                                                "No address set"}
                                        </p>
                                        {(loc.phone || loc.email) && (
                                            <p className="truncate text-xs text-muted-foreground">
                                                {[loc.phone, loc.email].filter(Boolean).join(" · ")}
                                            </p>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <div className="flex items-center gap-1.5">
                                            {!loc.is_primary && loc.is_active && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => void setPrimary(loc.id)}
                                                >
                                                    Make primary
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => void toggleActive(loc)}
                                            >
                                                {loc.is_active ? "Disable" : "Enable"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                aria-label={`Delete ${loc.name}`}
                                                onClick={() => void removeLocation(loc.id, loc.name)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </ListPageShell>
    );
}
