"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Car,
    Check,
    DollarSign,
    FileText,
    Loader2,
    Percent,
    User,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { cn, formatCurrency } from "@/src/lib/utils";

const STEPS = [
    { id: 1, label: "Customer", icon: User },
    { id: 2, label: "Vehicle", icon: Car },
    { id: 3, label: "Pricing", icon: DollarSign },
    { id: 4, label: "Finance & F&I", icon: Percent },
    { id: 5, label: "Review", icon: FileText },
] as const;

interface VehicleOption {
    id: string;
    year: number;
    make: string;
    model: string;
    retail_price: number;
    vin: string;
    status: string;
}

interface CustomerOption {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface SalespersonOption {
    id: string;
    full_name: string;
}

export default function NewDealWizardPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-24 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            }
        >
            <NewDealWizardInner />
        </Suspense>
    );
}

function NewDealWizardInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);
    const [form, setForm] = useState({
        customer_id: "",
        vehicle_id: "",
        sale_price: 0,
        down_payment: 0,
        trade_in_value: 0,
        admin_fee: 0,
        finance_term: "",
        interest_rate: "",
        finance_company: "",
        salesperson_id: "",
        notes: "",
        deal_status: "Negotiation",
        deal_date: new Date().toISOString().split("T")[0],
        warranty_package: "",
        gap_coverage: false,
        tire_coverage: false,
        paint_protection: false,
        extended_service: false,
        commission_rate: "",
        financing_notes: "",
        lead_id: "",
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [v, c, u] = await Promise.all([
                    apiFetch<{ data: VehicleOption[] }>(
                        "/api/vehicles?limit=500&status=Active",
                        { silent: true }
                    ),
                    apiFetch<{ data: CustomerOption[] }>(
                        "/api/customers?limit=500",
                        { silent: true }
                    ),
                    apiFetch<{ data: SalespersonOption[] }>(
                        "/api/users?limit=100",
                        { silent: true }
                    ),
                ]);
                if (cancelled) return;
                setVehicles(v?.data ?? []);
                setCustomers(c?.data ?? []);
                setSalespersons(u?.data ?? []);
                const leadId = searchParams?.get("lead_id") || "";
                const customerId = searchParams?.get("customer_id") || "";
                const vehicleId = searchParams?.get("vehicle_id") || "";
                if (leadId || customerId || vehicleId) {
                    setForm((f) => ({
                        ...f,
                        lead_id: leadId,
                        customer_id: customerId || f.customer_id,
                        vehicle_id: vehicleId || f.vehicle_id,
                    }));
                }
            } catch {
                if (!cancelled) toast.error("Failed to load form options");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_id);
    const selectedCustomer = customers.find((c) => c.id === form.customer_id);
    const selectedSalesperson = salespersons.find(
        (s) => s.id === form.salesperson_id
    );

    useEffect(() => {
        if (selectedVehicle && form.sale_price === 0) {
            setForm((f) => ({
                ...f,
                sale_price: selectedVehicle.retail_price || 0,
            }));
        }
    }, [selectedVehicle, form.sale_price]);

    const amountFinanced = useMemo(() => {
        return Math.max(
            0,
            (form.sale_price || 0) +
                (form.admin_fee || 0) -
                (form.down_payment || 0) -
                (form.trade_in_value || 0)
        );
    }, [
        form.sale_price,
        form.admin_fee,
        form.down_payment,
        form.trade_in_value,
    ]);

    const commissionAmount = useMemo(() => {
        const rate = Number(form.commission_rate) || 0;
        if (rate <= 0) return 0;
        return Math.round(((form.sale_price || 0) * rate) / 100);
    }, [form.sale_price, form.commission_rate]);

    const estimatedMonthly = useMemo(() => {
        const term = Number(form.finance_term) || 0;
        if (term <= 0 || amountFinanced <= 0) return null;
        const rate = (Number(form.interest_rate) || 0) / 100 / 12;
        if (rate <= 0) return amountFinanced / term;
        const factor = Math.pow(1 + rate, term);
        return (amountFinanced * rate * factor) / (factor - 1);
    }, [form.finance_term, form.interest_rate, amountFinanced]);

    const canNext = (): boolean => {
        switch (step) {
            case 1:
                return true; // cash / walk-in allowed
            case 2:
                return Boolean(form.vehicle_id);
            case 3:
                return form.sale_price > 0;
            case 4:
                return true;
            case 5:
                return Boolean(form.vehicle_id) && form.sale_price > 0;
            default: {
                const _exhaustive: never = step as never;
                void _exhaustive;
                return false;
            }
        }
    };

    async function submit() {
        if (!form.vehicle_id || form.sale_price <= 0) {
            toast.error("Vehicle and sale price are required");
            return;
        }
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                vehicle_id: form.vehicle_id,
                sale_price: form.sale_price,
                down_payment: form.down_payment || 0,
                trade_in_value: form.trade_in_value || 0,
                admin_fee: form.admin_fee || 0,
                deal_status: form.deal_status,
                deal_date: form.deal_date,
                notes: form.lead_id
                    ? [form.notes, `Converted from lead ${form.lead_id}`]
                          .filter(Boolean)
                          .join("\n")
                    : form.notes || null,
                gap_coverage: form.gap_coverage,
                tire_coverage: form.tire_coverage,
                paint_protection: form.paint_protection,
                extended_service: form.extended_service,
            };
            if (form.customer_id) payload.customer_id = form.customer_id;
            if (form.salesperson_id) payload.salesperson_id = form.salesperson_id;
            if (form.finance_term)
                payload.finance_term = Number(form.finance_term);
            if (form.interest_rate)
                payload.interest_rate = Number(form.interest_rate);
            if (form.finance_company)
                payload.finance_company = form.finance_company;
            if (form.warranty_package)
                payload.warranty_package = form.warranty_package;
            if (form.financing_notes)
                payload.financing_notes = form.financing_notes;
            if (form.commission_rate) {
                payload.commission_rate = Number(form.commission_rate);
                payload.commission_amount = commissionAmount;
            }

            const res = await apiFetch<{ data: { id: string } }>("/api/deals", {
                method: "POST",
                body: payload,
            });

            if (form.lead_id && res.data?.id) {
                try {
                    await apiFetch(`/api/leads/${form.lead_id}`, {
                        method: "PATCH",
                        body: {
                            status: "Closed",
                            converted_deal_id: res.data.id,
                            notes: `Converted to deal ${res.data.id}`,
                        },
                        silent: true,
                    });
                } catch {
                    // non-blocking
                }
            }

            toast.success("Deal created");
            router.push(res.data?.id ? `/deals/${res.data.id}` : "/deals");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to create deal"
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
            <PageHeader
                title="New deal"
                description="5-step create flow — trade-in, F&I, commission"
                icon={FileText}
                actions={
                    <Link
                        href="/deals"
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </Link>
                }
            />

            <ol className="flex flex-wrap gap-2">
                {STEPS.map((s) => {
                    const Icon = s.icon;
                    const active = step === s.id;
                    const done = step > s.id;
                    return (
                        <li key={s.id} className="flex-1 min-w-[5.5rem]">
                            <button
                                type="button"
                                onClick={() => setStep(s.id)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                                    active &&
                                        "border-primary bg-primary/5 text-primary",
                                    done &&
                                        !active &&
                                        "border-success/40 bg-success/5 text-success",
                                    !active &&
                                        !done &&
                                        "border-border bg-card text-muted-foreground"
                                )}
                            >
                                <span
                                    className={cn(
                                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px]",
                                        active || done
                                            ? "bg-primary text-white"
                                            : "bg-muted"
                                    )}
                                >
                                    {done ? (
                                        <Check className="h-3.5 w-3.5" />
                                    ) : (
                                        <Icon className="h-3.5 w-3.5" />
                                    )}
                                </span>
                                {s.label}
                            </button>
                        </li>
                    );
                })}
            </ol>

            <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                {step === 1 && (
                    <>
                        <label className="block text-sm font-medium">
                            Customer (optional — leave blank for cash)
                        </label>
                        <select
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.customer_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    customer_id: e.target.value,
                                })
                            }
                        >
                            <option value="">Cash / walk-in</option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                    {c.phone ? ` · ${c.phone}` : ""}
                                </option>
                            ))}
                        </select>
                        <label className="block text-sm font-medium">
                            Salesperson
                        </label>
                        <select
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.salesperson_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    salesperson_id: e.target.value,
                                })
                            }
                        >
                            <option value="">Unassigned</option>
                            {salespersons.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name}
                                </option>
                            ))}
                        </select>
                    </>
                )}

                {step === 2 && (
                    <>
                        <label className="block text-sm font-medium">
                            Vehicle *
                        </label>
                        <select
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.vehicle_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    vehicle_id: e.target.value,
                                    sale_price: 0,
                                })
                            }
                        >
                            <option value="">Select active vehicle</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.year} {v.make} {v.model} ·{" "}
                                    {formatCurrency(v.retail_price || 0)}
                                    {v.vin ? ` · ${v.vin.slice(-6)}` : ""}
                                </option>
                            ))}
                        </select>
                        {selectedVehicle && (
                            <p className="text-xs text-muted-foreground">
                                VIN {selectedVehicle.vin || "—"} · Retail{" "}
                                {formatCurrency(
                                    selectedVehicle.retail_price || 0
                                )}
                            </p>
                        )}
                    </>
                )}

                {step === 3 && (
                    <>
                        <label className="block text-sm font-medium">
                            Sale price *
                        </label>
                        <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.sale_price || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    sale_price: Number(e.target.value) || 0,
                                })
                            }
                        />
                        <label className="block text-sm font-medium">
                            Down payment
                        </label>
                        <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.down_payment || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    down_payment: Number(e.target.value) || 0,
                                })
                            }
                        />
                        <label className="block text-sm font-medium">
                            Trade-in value
                        </label>
                        <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.trade_in_value || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    trade_in_value: Number(e.target.value) || 0,
                                })
                            }
                        />
                        <label className="block text-sm font-medium">
                            Admin / doc fee
                        </label>
                        <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.admin_fee || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    admin_fee: Number(e.target.value) || 0,
                                })
                            }
                        />
                        <label className="block text-sm font-medium">
                            Deal date
                        </label>
                        <input
                            type="date"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.deal_date}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    deal_date: e.target.value,
                                })
                            }
                        />
                        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">
                                Amount financed:{" "}
                            </span>
                            <strong>{formatCurrency(amountFinanced)}</strong>
                        </div>
                    </>
                )}

                {step === 4 && (
                    <>
                        <label className="block text-sm font-medium">
                            Finance term (months)
                        </label>
                        <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.finance_term}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    finance_term: e.target.value,
                                })
                            }
                            placeholder="e.g. 60"
                        />
                        <label className="block text-sm font-medium">
                            Interest rate %
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.interest_rate}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    interest_rate: e.target.value,
                                })
                            }
                        />
                        <label className="block text-sm font-medium">
                            Finance company
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.finance_company}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    finance_company: e.target.value,
                                })
                            }
                        />
                        <label className="block text-sm font-medium">
                            Warranty package
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.warranty_package}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    warranty_package: e.target.value,
                                })
                            }
                            placeholder="e.g. 3yr / 60k"
                        />
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium">
                                F&I products
                            </legend>
                            {(
                                [
                                    ["gap_coverage", "GAP coverage"],
                                    ["tire_coverage", "Tire & wheel"],
                                    ["paint_protection", "Paint protection"],
                                    ["extended_service", "Extended service"],
                                ] as const
                            ).map(([key, label]) => (
                                <label
                                    key={key}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={form[key]}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                [key]: e.target.checked,
                                            })
                                        }
                                    />
                                    {label}
                                </label>
                            ))}
                        </fieldset>
                        <label className="block text-sm font-medium">
                            Commission rate %
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.commission_rate}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    commission_rate: e.target.value,
                                })
                            }
                            placeholder="e.g. 25"
                        />
                        {commissionAmount > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Est. commission{" "}
                                {formatCurrency(commissionAmount)}
                                {selectedSalesperson
                                    ? ` · ${selectedSalesperson.full_name}`
                                    : ""}
                            </p>
                        )}
                        {estimatedMonthly != null && (
                            <p className="text-xs text-muted-foreground">
                                Est. monthly{" "}
                                {formatCurrency(estimatedMonthly)}
                            </p>
                        )}
                        <label className="block text-sm font-medium">
                            Status
                        </label>
                        <select
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.deal_status}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    deal_status: e.target.value,
                                })
                            }
                        >
                            <option value="Negotiation">Negotiation</option>
                            <option value="Down Payment">Down Payment</option>
                            <option value="Finance">Finance</option>
                            <option value="Paid Off">Paid Off</option>
                        </select>
                        <label className="block text-sm font-medium">
                            Financing notes
                        </label>
                        <textarea
                            className="min-h-[60px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.financing_notes}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    financing_notes: e.target.value,
                                })
                            }
                        />
                    </>
                )}

                {step === 5 && (
                    <div className="space-y-3 text-sm">
                        <p>
                            <span className="text-muted-foreground">
                                Customer:{" "}
                            </span>
                            <strong>
                                {selectedCustomer?.name || "Cash / walk-in"}
                            </strong>
                        </p>
                        <p>
                            <span className="text-muted-foreground">
                                Vehicle:{" "}
                            </span>
                            <strong>
                                {selectedVehicle
                                    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                                    : "—"}
                            </strong>
                        </p>
                        <p>
                            <span className="text-muted-foreground">
                                Sale:{" "}
                            </span>
                            <strong>
                                {formatCurrency(form.sale_price)}
                            </strong>
                            {form.down_payment > 0 && (
                                <span className="text-muted-foreground">
                                    {" "}
                                    (down {formatCurrency(form.down_payment)})
                                </span>
                            )}
                            {form.trade_in_value > 0 && (
                                <span className="text-muted-foreground">
                                    {" "}
                                    · trade{" "}
                                    {formatCurrency(form.trade_in_value)}
                                </span>
                            )}
                        </p>
                        <p>
                            <span className="text-muted-foreground">
                                Financed:{" "}
                            </span>
                            <strong>{formatCurrency(amountFinanced)}</strong>
                            {estimatedMonthly != null && (
                                <span className="text-muted-foreground">
                                    {" "}
                                    · ~{formatCurrency(estimatedMonthly)}/mo
                                </span>
                            )}
                        </p>
                        {(form.finance_term || form.interest_rate) && (
                            <p>
                                <span className="text-muted-foreground">
                                    Finance:{" "}
                                </span>
                                {form.finance_term
                                    ? `${form.finance_term} mo`
                                    : "—"}
                                {form.interest_rate
                                    ? ` @ ${form.interest_rate}%`
                                    : ""}
                                {form.finance_company
                                    ? ` · ${form.finance_company}`
                                    : ""}
                            </p>
                        )}
                        {(form.warranty_package ||
                            form.gap_coverage ||
                            form.tire_coverage ||
                            form.paint_protection ||
                            form.extended_service) && (
                            <p>
                                <span className="text-muted-foreground">
                                    F&I:{" "}
                                </span>
                                {[
                                    form.warranty_package,
                                    form.gap_coverage ? "GAP" : null,
                                    form.tire_coverage ? "Tire" : null,
                                    form.paint_protection ? "Paint" : null,
                                    form.extended_service
                                        ? "Extended service"
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}
                        {commissionAmount > 0 && (
                            <p>
                                <span className="text-muted-foreground">
                                    Commission:{" "}
                                </span>
                                {form.commission_rate}% ·{" "}
                                {formatCurrency(commissionAmount)}
                                {selectedSalesperson
                                    ? ` · ${selectedSalesperson.full_name}`
                                    : ""}
                            </p>
                        )}
                        <label className="block pt-2 text-sm font-medium">
                            Notes
                        </label>
                        <textarea
                            className="min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={form.notes}
                            onChange={(e) =>
                                setForm({ ...form, notes: e.target.value })
                            }
                        />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-3">
                <Button
                    variant="outline"
                    disabled={step === 1}
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                    Back
                </Button>
                {step < 5 ? (
                    <Button
                        disabled={!canNext()}
                        onClick={() => setStep((s) => Math.min(5, s + 1))}
                        rightIcon={<ArrowRight className="h-4 w-4" />}
                    >
                        Continue
                    </Button>
                ) : (
                    <Button
                        disabled={saving || !canNext()}
                        onClick={() => void submit()}
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Create deal"
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
