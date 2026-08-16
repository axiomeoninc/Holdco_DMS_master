"use client";

import { useCallback, useEffect, useState } from "react";
import {
    ShoppingCart,
    Plus,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    Car,
    Search,
    Pencil,
    Trash2,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ModalShell } from "@/src/components/ui/ModalShell";
import ConfirmDialog from "@/src/components/ConfirmDialog";

interface VehicleRef {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    stock_number: string | null;
    status: string;
    purchase_price: number | null;
}

interface Purchase {
    id: string;
    purchase_date: string;
    purchase_price: number;
    seller_name: string;
    seller_phone: string | null;
    seller_address: string | null;
    vin_verified: boolean;
    title_received: boolean;
    title_number: string | null;
    notes: string | null;
    vehicle_id: string | null;
    vehicle: VehicleRef | null;
    created_at: string;
    location_id?: string | null;
    source_kind?: string | null;
    auction_venue?: string | null;
    auction_lot_number?: string | null;
    auction_sale_date?: string | null;
    comp_notes?: string | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
    purchase_date: todayISO(),
    purchase_price: "",
    seller_name: "",
    seller_phone: "",
    seller_address: "",
    vin_verified: false,
    title_received: false,
    title_number: "",
    notes: "",
    create_vehicle: true,
    vin: "",
    year: "",
    make: "",
    model: "",
    trim: "",
    odometer: "",
    exterior_color: "",
    stock_number: "",
    // Auction / wholesale sourcing (honest record-keeping)
    source_kind: "",
    auction_venue: "",
    auction_lot_number: "",
    auction_sale_date: "",
    comp_notes: "",
};

type FormState = typeof emptyForm;

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(searchTerm.trim()), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const q = debouncedQ
                ? `&q=${encodeURIComponent(debouncedQ)}`
                : "";
            const res = await apiFetch<{ data: Purchase[] }>(
                `/api/purchases?limit=100${q}`
            );
            setPurchases(res.data || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load purchases");
        } finally {
            setLoading(false);
        }
    }, [debouncedQ]);

    useEffect(() => {
        void load();
    }, [load]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, purchase_date: todayISO() });
        setFormError(null);
        setShowForm(true);
    };

    const openEdit = (p: Purchase) => {
        setEditingId(p.id);
        setForm({
            ...emptyForm,
            purchase_date: p.purchase_date?.slice(0, 10) || emptyForm.purchase_date,
            purchase_price: String(p.purchase_price ?? ""),
            seller_name: p.seller_name || "",
            seller_phone: p.seller_phone || "",
            seller_address: p.seller_address || "",
            vin_verified: Boolean(p.vin_verified),
            title_received: Boolean(p.title_received),
            title_number: p.title_number || "",
            notes: p.notes || "",
            create_vehicle: false,
            source_kind: p.source_kind || "",
            auction_venue: p.auction_venue || "",
            auction_lot_number: p.auction_lot_number || "",
            auction_sale_date: p.auction_sale_date?.slice(0, 10) || "",
            comp_notes: p.comp_notes || "",
        });
        setFormError(null);
        setShowForm(true);
    };

    async function onSave() {
        setFormError(null);
        if (!form.seller_name.trim()) {
            setFormError("Seller name is required");
            return;
        }
        if (!form.purchase_date) {
            setFormError("Purchase date is required");
            return;
        }
        if (!form.purchase_price || Number.isNaN(Number(form.purchase_price))) {
            setFormError("Purchase price is required");
            return;
        }
        if (!editingId && form.create_vehicle) {
            if (!form.vin.trim() || !form.year || !form.make.trim() || !form.model.trim()) {
                setFormError("VIN, year, make, and model are required when creating a vehicle");
                return;
            }
        }

        setSaving(true);
        try {
            if (editingId) {
                await apiFetch("/api/purchases", {
                    method: "PATCH",
                    body: {
                        id: editingId,
                        purchase_date: form.purchase_date,
                        purchase_price: Number(form.purchase_price),
                        seller_name: form.seller_name.trim(),
                        seller_phone: form.seller_phone.trim() || null,
                        seller_address: form.seller_address.trim() || null,
                        vin_verified: form.vin_verified,
                        title_received: form.title_received,
                        title_number: form.title_number.trim() || null,
                        notes: form.notes.trim() || null,
                        source_kind: form.source_kind || null,
                        auction_venue: form.auction_venue.trim() || null,
                        auction_lot_number: form.auction_lot_number.trim() || null,
                        auction_sale_date: form.auction_sale_date || null,
                        comp_notes: form.comp_notes.trim() || null,
                    },
                });
                toast.success("Purchase updated");
            } else {
                const payload: Record<string, unknown> = {
                    purchase_date: form.purchase_date,
                    purchase_price: Number(form.purchase_price),
                    seller_name: form.seller_name.trim(),
                    seller_phone: form.seller_phone.trim() || null,
                    seller_address: form.seller_address.trim() || null,
                    vin_verified: form.vin_verified,
                    title_received: form.title_received,
                    title_number: form.title_number.trim() || null,
                    notes: form.notes.trim() || null,
                    create_vehicle: form.create_vehicle,
                    source_kind: form.source_kind || null,
                    auction_venue: form.auction_venue.trim() || null,
                    auction_lot_number: form.auction_lot_number.trim() || null,
                    auction_sale_date: form.auction_sale_date || null,
                    comp_notes: form.comp_notes.trim() || null,
                };
                if (form.create_vehicle) {
                    payload.vehicle = {
                        vin: form.vin.trim().toUpperCase(),
                        year: Number(form.year),
                        make: form.make.trim(),
                        model: form.model.trim(),
                        trim: form.trim.trim() || null,
                        odometer: form.odometer ? Number(form.odometer) : 0,
                        exterior_color: form.exterior_color.trim() || null,
                        stock_number: form.stock_number.trim() || null,
                        condition: "Used",
                    };
                }
                await apiFetch("/api/purchases", { method: "POST", body: payload });
                toast.success("Purchase recorded");
            }
            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm);
            await load();
        } catch (e: unknown) {
            setFormError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await apiFetch(`/api/purchases?id=${encodeURIComponent(deleteTarget.id)}`, {
                method: "DELETE",
            });
            toast.success("Purchase deleted");
            setDeleteTarget(null);
            await load();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
        } finally {
            setDeleting(false);
        }
    }

    const money = (n: number) =>
        new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

    const hasSearch = Boolean(debouncedQ);

    return (
        <div className="space-y-3 px-3 py-4 sm:px-5">
            <PageHeader
                title="Purchase from Public"
                description="Record private-party vehicle acquisitions and title intake."
                icon={ShoppingCart}
                breadcrumbs={[
                    { label: "Inventory", href: "/inventory" },
                    { label: "Purchases" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            New purchase
                        </Button>
                    </div>
                }
            />

            <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search seller, phone, title #, notes…"
                    className="pl-9"
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading purchases…
                </div>
            ) : purchases.length === 0 ? (
                <EmptyState
                    icon={ShoppingCart}
                    title={hasSearch ? "No purchases match" : "No public purchases yet"}
                    description={
                        hasSearch
                            ? "Try a different seller name, phone, or title number."
                            : "Record the first private-party acquisition to start the history."
                    }
                    action={
                        hasSearch
                            ? undefined
                            : {
                                  label: "New purchase",
                                  icon: Plus,
                                  onClick: openCreate,
                              }
                    }
                />
            ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Seller</th>
                                <th className="px-4 py-3">Vehicle</th>
                                <th className="px-4 py-3">Price</th>
                                <th className="px-4 py-3">VIN</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {purchases.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50/80">
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                        {p.purchase_date}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{p.seller_name}</div>
                                        {p.seller_phone && (
                                            <div className="text-xs text-gray-500">{p.seller_phone}</div>
                                        )}
                                        {p.source_kind && (
                                            <div className="mt-0.5 text-[11px] text-blue-600">
                                                {p.source_kind === "auction"
                                                    ? [
                                                          p.auction_venue,
                                                          p.auction_lot_number
                                                              ? `Lot #${p.auction_lot_number}`
                                                              : null,
                                                      ]
                                                          .filter(Boolean)
                                                          .join(" · ")
                                                    : p.source_kind}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.vehicle ? (
                                            <div className="flex items-start gap-2">
                                                <Car className="mt-0.5 h-4 w-4 text-gray-400" />
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {p.vehicle.year} {p.vehicle.make} {p.vehicle.model}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {p.vehicle.stock_number || p.vehicle.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                                        {money(Number(p.purchase_price))}
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.vin_verified ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-600">
                                                <CheckCircle className="h-3.5 w-3.5" /> Verified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-gray-400">
                                                <XCircle className="h-3.5 w-3.5" /> Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.title_received ? (
                                            <span className="text-emerald-600">
                                                Received{p.title_number ? ` · ${p.title_number}` : ""}
                                            </span>
                                        ) : (
                                            <span className="text-amber-600">Outstanding</span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(p)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                                aria-label="Edit purchase"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteTarget(p)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"
                                                aria-label="Delete purchase"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ModalShell
                open={showForm}
                onClose={() => !saving && setShowForm(false)}
                title={editingId ? "Edit purchase" : "Purchase from Public"}
                description={
                    editingId
                        ? "Update seller, price, and title intake fields."
                        : "Seller, vehicle, and title intake for a private-party buy."
                }
                size="2xl"
                error={formError}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={() => void onSave()} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {editingId ? "Save changes" : "Save purchase"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Seller</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-gray-600">Name *</span>
                                <Input
                                    value={form.seller_name}
                                    onChange={(e) => setForm({ ...form, seller_name: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Phone</span>
                                <Input
                                    value={form.seller_phone}
                                    onChange={(e) => setForm({ ...form, seller_phone: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Purchase date *</span>
                                <Input
                                    type="date"
                                    value={form.purchase_date}
                                    onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-gray-600">Address</span>
                                <Input
                                    value={form.seller_address}
                                    onChange={(e) => setForm({ ...form, seller_address: e.target.value })}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Purchase</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Price (CAD) *</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.purchase_price}
                                    onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Title number</span>
                                <Input
                                    value={form.title_number}
                                    onChange={(e) => setForm({ ...form, title_number: e.target.value })}
                                />
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={form.vin_verified}
                                    onChange={(e) => setForm({ ...form, vin_verified: e.target.checked })}
                                />
                                VIN verified
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={form.title_received}
                                    onChange={(e) => setForm({ ...form, title_received: e.target.checked })}
                                />
                                Title received
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-gray-600">Notes</span>
                                <textarea
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    rows={2}
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                                Auction / wholesale sourcing
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-500">
                                Where this unit was sourced. Record-keeping only — no market-value
                                claims and no auto-bidding.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Source kind</span>
                                <select
                                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    value={form.source_kind}
                                    onChange={(e) => setForm({ ...form, source_kind: e.target.value })}
                                >
                                    <option value="">Not specified</option>
                                    <option value="public">Public seller</option>
                                    <option value="auction">Auction</option>
                                    <option value="wholesale">Wholesale</option>
                                    <option value="trade">Trade-in</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Auction venue</span>
                                <Input
                                    value={form.auction_venue}
                                    onChange={(e) => setForm({ ...form, auction_venue: e.target.value })}
                                    placeholder="e.g. ADESA Toronto"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Lot number</span>
                                <Input
                                    value={form.auction_lot_number}
                                    onChange={(e) =>
                                        setForm({ ...form, auction_lot_number: e.target.value })
                                    }
                                    placeholder="e.g. 4821"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-600">Sale date</span>
                                <Input
                                    type="date"
                                    value={form.auction_sale_date}
                                    onChange={(e) =>
                                        setForm({ ...form, auction_sale_date: e.target.value })
                                    }
                                />
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                                <span className="text-xs font-medium text-gray-600">
                                    Comp notes (desk)
                                </span>
                                <textarea
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    rows={2}
                                    value={form.comp_notes}
                                    onChange={(e) => setForm({ ...form, comp_notes: e.target.value })}
                                    placeholder="Comparable condition notes from the desk. Not a market-data source."
                                />
                            </label>
                        </div>
                    </section>

                    {!editingId && (
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">Vehicle intake</h3>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={form.create_vehicle}
                                        onChange={(e) =>
                                            setForm({ ...form, create_vehicle: e.target.checked })
                                        }
                                    />
                                    Create inventory vehicle
                                </label>
                            </div>
                            {form.create_vehicle && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block space-y-1 sm:col-span-2">
                                        <span className="text-xs font-medium text-gray-600">VIN *</span>
                                        <Input
                                            value={form.vin}
                                            onChange={(e) => setForm({ ...form, vin: e.target.value })}
                                            className="font-mono uppercase"
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">Year *</span>
                                        <Input
                                            type="number"
                                            value={form.year}
                                            onChange={(e) => setForm({ ...form, year: e.target.value })}
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">Stock #</span>
                                        <Input
                                            value={form.stock_number}
                                            onChange={(e) =>
                                                setForm({ ...form, stock_number: e.target.value })
                                            }
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">Make *</span>
                                        <Input
                                            value={form.make}
                                            onChange={(e) => setForm({ ...form, make: e.target.value })}
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">Model *</span>
                                        <Input
                                            value={form.model}
                                            onChange={(e) => setForm({ ...form, model: e.target.value })}
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">Trim</span>
                                        <Input
                                            value={form.trim}
                                            onChange={(e) => setForm({ ...form, trim: e.target.value })}
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">Odometer</span>
                                        <Input
                                            type="number"
                                            value={form.odometer}
                                            onChange={(e) =>
                                                setForm({ ...form, odometer: e.target.value })
                                            }
                                        />
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-medium text-gray-600">
                                            Exterior color
                                        </span>
                                        <Input
                                            value={form.exterior_color}
                                            onChange={(e) =>
                                                setForm({ ...form, exterior_color: e.target.value })
                                            }
                                        />
                                    </label>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </ModalShell>

            {deleteTarget && (
                <ConfirmDialog
                    isOpen={Boolean(deleteTarget)}
                    title="Delete purchase"
                    message={`Delete purchase from ${deleteTarget.seller_name} on ${deleteTarget.purchase_date}? The linked inventory vehicle (if any) is not deleted.`}
                    confirmText="Delete"
                    variant="danger"
                    loading={deleting}
                    onConfirm={() => void confirmDelete()}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
