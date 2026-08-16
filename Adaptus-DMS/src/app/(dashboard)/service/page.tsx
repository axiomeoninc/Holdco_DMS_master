"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Wrench,
    Plus,
    RefreshCw,
    Loader2,
    AlertCircle,
    Search,
    Pencil,
    Trash2,
    CalendarDays,
    Gauge,
    Users,
    Info,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import {
    SERVICE_TYPES,
    SERVICE_STATUSES,
    SERVICE_TYPE_LABELS,
    type ServiceRecord,
    type ServiceReactivationCandidate,
} from "@/src/lib/service";

type Tab = "records" | "reactivation";

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
    service_date: todayISO(),
    odometer: "",
    service_type: "oil_change",
    status: "completed",
    notes: "",
    cost: "",
    performed_by: "",
    customer_id: "",
    vehicle_id: "",
};

type FormState = typeof emptyForm;

export default function ServicePage() {
    const [tab, setTab] = useState<Tab>("records");
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ServiceRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [customers, setCustomers] = useState<{ id: string; label: string }[]>([]);
    const [vehicles, setVehicles] = useState<{ id: string; label: string }[]>([]);
    // Reactivation (informational, consent-gated)
    const [candidates, setCandidates] = useState<ServiceReactivationCandidate[]>([]);
    const [candidatesLoading, setCandidatesLoading] = useState(false);
    const [reactivationDays, setReactivationDays] = useState(180);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(searchTerm), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const loadRecords = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const url = debouncedQ
                ? `/api/service/records?q=${encodeURIComponent(debouncedQ)}`
                : "/api/service/records";
            const res = await apiFetch<{ data: ServiceRecord[] }>(url);
            setRecords(res.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load service records");
        } finally {
            setLoading(false);
        }
    }, [debouncedQ]);

    const loadCandidates = useCallback(async () => {
        try {
            setCandidatesLoading(true);
            const res = await apiFetch<{ data: ServiceReactivationCandidate[] }>(
                `/api/service/reactivation?days=${reactivationDays}`
            );
            setCandidates(res.data || []);
        } catch {
            setCandidates([]);
        } finally {
            setCandidatesLoading(false);
        }
    }, [reactivationDays]);

    useEffect(() => {
        void loadRecords();
    }, [loadRecords]);

    useEffect(() => {
        if (tab === "reactivation") void loadCandidates();
    }, [tab, loadCandidates]);

    const loadRefs = useCallback(async () => {
        try {
            const [custRes, vehRes] = await Promise.all([
                apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/customers?limit=500"),
                apiFetch<{ data: Array<{ id: string; year: number; make: string; model: string }> }>(
                    "/api/vehicles?limit=500&status=Active"
                ),
            ]);
            setCustomers((custRes.data || []).map((c) => ({ id: c.id, label: c.name })));
            setVehicles(
                (vehRes.data || []).map((v) => ({
                    id: v.id,
                    label: `${v.year} ${v.make} ${v.model}`,
                }))
            );
        } catch {
            // refs are best-effort
        }
    }, []);

    function openAdd() {
        setEditingId(null);
        setForm(emptyForm);
        setFormError(null);
        void loadRefs();
        setShowForm(true);
    }

    function openEdit(rec: ServiceRecord) {
        setEditingId(rec.id);
        setForm({
            service_date: rec.service_date.slice(0, 10),
            odometer: rec.odometer != null ? String(rec.odometer) : "",
            service_type: rec.service_type,
            status: rec.status,
            notes: rec.notes || "",
            cost: rec.cost != null ? String(rec.cost) : "",
            performed_by: rec.performed_by || "",
            customer_id: rec.customer_id || "",
            vehicle_id: rec.vehicle_id || "",
        });
        setFormError(null);
        void loadRefs();
        setShowForm(true);
    }

    async function save() {
        if (!form.service_date) {
            setFormError("Service date is required.");
            return;
        }
        if (!form.customer_id && !form.vehicle_id) {
            setFormError("Link at least a customer or a vehicle.");
            return;
        }
        try {
            setSaving(true);
            const payload = {
                ...form,
                odometer: form.odometer ? Number(form.odometer) : null,
                cost: form.cost ? Number(form.cost) : null,
            };
            if (editingId) {
                await apiFetch(`/api/service/records/${editingId}`, { method: "PATCH", body: payload });
                toast.success("Service record updated", "Changes saved.");
            } else {
                await apiFetch("/api/service/records", { method: "POST", body: payload });
                toast.success("Service record added", "Saved to service history.");
            }
            setShowForm(false);
            void loadRecords();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await apiFetch(`/api/service/records/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Service record deleted", deleteTarget.notes || "Removed.");
            setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            toast.error("Delete failed", err instanceof Error ? err.message : "Try again");
        } finally {
            setDeleting(false);
        }
    }

    const recordsCount = records.length;

    return (
        <ListPageShell
            title="Service"
            description="Vehicle service history and consent-gated reactivation candidates. Reactivation is informational — no messages are sent automatically."
            icon={Wrench}
            actions={
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (tab === "records" ? void loadRecords() : void loadCandidates())}
                        disabled={loading || candidatesLoading}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={openAdd}>
                        <Plus className="h-3.5 w-3.5" />
                        Add service
                    </Button>
                </div>
            }
        >
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Service views">
                <button
                    type="button"
                    role="tab"
                    id="tab-records"
                    aria-selected={tab === "records"}
                    aria-controls="panel-records"
                    onClick={() => setTab("records")}
                    className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        tab === "records"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Service history
                </button>
                <button
                    type="button"
                    role="tab"
                    id="tab-reactivation"
                    aria-selected={tab === "reactivation"}
                    aria-controls="panel-reactivation"
                    onClick={() => setTab("reactivation")}
                    className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        tab === "reactivation"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Users className="h-3.5 w-3.5" />
                    Reactivation candidates
                </button>
            </div>

            {tab === "records" ? (
                <div
                    id="panel-records"
                    role="tabpanel"
                    aria-labelledby="tab-records"
                    className="space-y-4"
                >
                    <div className="relative max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search notes, customer…"
                            className="min-h-10 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading service records…
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                                <p className="font-medium">Could not load service records</p>
                                <p className="mt-0.5 text-destructive/80">{error}</p>
                            </div>
                        </div>
                    ) : records.length === 0 ? (
                        <EmptyState
                            title={debouncedQ ? "No matching service records" : "No service records yet"}
                            description={
                                debouncedQ
                                    ? "Try a different search."
                                    : "Add a service record to start building vehicle + customer service history."
                            }
                            icon={Wrench}
                        />
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2.5">Customer</th>
                                            <th className="px-3 py-2.5">Vehicle</th>
                                            <th className="px-3 py-2.5">Service</th>
                                            <th className="px-3 py-2.5">Date</th>
                                            <th className="px-3 py-2.5">Odometer</th>
                                            <th className="px-3 py-2.5">Status</th>
                                            <th className="px-3 py-2.5">Cost</th>
                                            <th className="px-3 py-2.5" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {records.map((rec) => (
                                            <tr key={rec.id} className="hover:bg-muted/40">
                                                <td className="px-3 py-2.5">
                                                    {rec.customer?.name || "—"}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {rec.vehicle
                                                        ? `${rec.vehicle.year} ${rec.vehicle.make} ${rec.vehicle.model}`
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {SERVICE_TYPE_LABELS[rec.service_type] ||
                                                        rec.service_type}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {rec.service_date}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Gauge className="h-3 w-3 text-muted-foreground" />
                                                        {rec.odometer != null
                                                            ? `${rec.odometer.toLocaleString()} km`
                                                            : "—"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <StatusBadge status={rec.status} />
                                                </td>
                                                <td className="px-3 py-2.5 tabular-nums">
                                                    {rec.cost != null ? `$${rec.cost.toLocaleString()}` : "—"}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => openEdit(rec)} aria-label="Edit">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setDeleteTarget(rec)}
                                                            aria-label="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {recordsCount} record{recordsCount === 1 ? "" : "s"} · Service history is
                        dealership-scoped.
                    </p>
                </div>
            ) : (
                <div
                    id="panel-reactivation"
                    role="tabpanel"
                    aria-labelledby="tab-reactivation"
                    className="space-y-4"
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            Last service older than
                            <input
                                type="number"
                                min={30}
                                value={reactivationDays}
                                onChange={(e) =>
                                    setReactivationDays(Math.max(30, parseInt(e.target.value) || 180))
                                }
                                className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm"
                            />
                            days
                        </label>
                        <Button variant="outline" size="sm" onClick={() => void loadCandidates()} disabled={candidatesLoading}>
                            {candidatesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Recompute
                        </Button>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                            Informational list only. Candidates are customers who explicitly opted in
                            to service contact and whose last recorded service is older than the
                            threshold. Nothing here sends email or SMS — it is a call list for your
                            desk.
                        </p>
                    </div>

                    {candidatesLoading ? (
                        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Building candidates…
                        </div>
                    ) : candidates.length === 0 ? (
                        <EmptyState
                            title="No reactivation candidates"
                            description="Customers with service-contact consent and an older last service will appear here."
                            icon={Users}
                        />
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2.5">Customer</th>
                                            <th className="px-3 py-2.5">Last service</th>
                                            <th className="px-3 py-2.5">Type</th>
                                            <th className="px-3 py-2.5">Days since</th>
                                            <th className="px-3 py-2.5">Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {candidates.map((c) => (
                                            <tr key={c.customer_id} className="hover:bg-muted/40">
                                                <td className="px-3 py-2.5 font-medium">
                                                    {c.customer_name}
                                                </td>
                                                <td className="px-3 py-2.5">{c.last_service_date}</td>
                                                <td className="px-3 py-2.5">
                                                    {c.last_service_type
                                                        ? SERVICE_TYPE_LABELS[c.last_service_type] ||
                                                          c.last_service_type
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-2.5 tabular-nums">
                                                    {c.days_since_last_service}d
                                                </td>
                                                <td className="px-3 py-2.5 text-muted-foreground">
                                                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit modal */}
            <ModalShell
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editingId ? "Edit service record" : "Add service record"}
                description="Record a service event on a customer's vehicle."
            >
                <div className="space-y-3">
                    {formError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            {formError}
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Customer</span>
                            <select
                                value={form.customer_id}
                                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            >
                                <option value="">None</option>
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Vehicle</span>
                            <select
                                value={form.vehicle_id}
                                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            >
                                <option value="">None</option>
                                {vehicles.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Service date *</span>
                            <input
                                type="date"
                                value={form.service_date}
                                onChange={(e) => setForm({ ...form, service_date: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Odometer (km)</span>
                            <input
                                type="number"
                                value={form.odometer}
                                onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Service type</span>
                            <select
                                value={form.service_type}
                                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            >
                                {SERVICE_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {SERVICE_TYPE_LABELS[t]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Status</span>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            >
                                {SERVICE_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Cost ($)</span>
                            <input
                                type="number"
                                value={form.cost}
                                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Performed by</span>
                            <input
                                value={form.performed_by}
                                onChange={(e) => setForm({ ...form, performed_by: e.target.value })}
                                className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            />
                        </label>
                        <label className="block space-y-1 text-xs sm:col-span-2">
                            <span className="font-medium text-muted-foreground">Notes</span>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                rows={3}
                                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                            />
                        </label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={() => void save()} disabled={saving} loading={saving}>
                            Save record
                        </Button>
                    </div>
                </div>
            </ModalShell>

            <ConfirmDialog
                isOpen={Boolean(deleteTarget)}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => void confirmDelete()}
                loading={deleting}
                title="Delete service record?"
                message="This removes the service history entry. Customer and vehicle data are not touched."
                confirmText="Delete"
                variant="danger"
            />
        </ListPageShell>
    );
}
