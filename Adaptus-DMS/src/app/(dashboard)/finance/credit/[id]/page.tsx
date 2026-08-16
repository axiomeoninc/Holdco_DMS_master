"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    CreditCard,
    Loader2,
    Send,
    AlertCircle,
    ShieldCheck,
    ArrowLeft,
    CheckCircle2,
} from "lucide-react";
import { ListPageShell } from "@/src/components/ListPageShell";
import { Button } from "@/src/components/ui/Button";
import { apiFetch, ApiError } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import {
    applicantFullName,
    computeScreeningSummary,
    type ScreeningSummary,
} from "@/src/lib/credit/credit-app";

type CreditApplication = {
    id: string;
    status: string;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    employer: string | null;
    employment_years: number | null;
    annual_income: number | null;
    monthly_rent: number | null;
    requested_amount: number | null;
    trade_in_value: number | null;
    trade_in_payoff: number | null;
    coapplicant_first_name: string | null;
    coapplicant_last_name: string | null;
    coapplicant_annual_income: number | null;
    coapplicant_employer: string | null;
    ocr_confidence: number | null;
    partner_channel_configured: boolean;
    partner_submitted_at: string | null;
    partner_reference: string | null;
    notes: string | null;
    created_at: string;
    customer: { id: string; name: string | null } | null;
    vehicle: { id: string; year: number; make: string; model: string; stock_number: string | null } | null;
    screening_summary: ScreeningSummary | Record<string, unknown>;
};

function formatCad(n: number | null): string {
    if (n === null || n === undefined) return "—";
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
    }).format(n);
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="text-sm text-foreground">{value}</p>
        </div>
    );
}

export default function CreditApplicationDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [app, setApp] = useState<CreditApplication | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch<{ data: CreditApplication }>(
                `/api/crm/credit-applications/${id}`,
                { silent: true }
            );
            setApp(res.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load application");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    async function submitToPartner() {
        setSubmitting(true);
        try {
            const res = await apiFetch<{ message?: string }>(
                `/api/crm/credit-applications/${id}/submit`,
                { method: "POST", body: {}, silent: true }
            );
            toast.success(res.message || "Marked submitted to partner");
            await load();
        } catch (err) {
            if (err instanceof ApiError && err.status === 422) {
                toast.error(err.message);
                return;
            }
            toast.error(err instanceof Error ? err.message : "Submit failed");
        } finally {
            setSubmitting(false);
        }
    }

    const summary =
        app && app.screening_summary && "missing_fields" in app.screening_summary
            ? (app.screening_summary as ScreeningSummary)
            : app
              ? computeScreeningSummary(app)
              : null;

    return (
        <ListPageShell
            title={app ? applicantFullName(app) : "Credit Application"}
            description="Screening-ready summary — partner-led screening, not a lender network"
            icon={CreditCard}
            breadcrumbs={[
                { label: "Finance", href: "/finance" },
                { label: "Credit", href: "/finance/credit" },
                { label: app ? applicantFullName(app) : "Detail" },
            ]}
            actions={
                <Link
                    href="/finance/credit"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Link>
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
            ) : app ? (
                <div className="max-w-3xl space-y-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold capitalize">
                            {app.status.replace("_", " ")}
                        </span>
                        {app.partner_submitted_at ? (
                            <span className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Submitted to partner{" "}
                                {new Date(app.partner_submitted_at).toLocaleDateString()}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                                <AlertCircle className="h-3 w-3" />
                                {app.partner_channel_configured
                                    ? "Partner channel ready — not yet submitted"
                                    : "No partner channel configured"}
                            </span>
                        )}
                    </div>

                    {/* Screening summary */}
                    {summary && (
                        <div className="rounded-lg border border-border bg-card p-5">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                Screening-ready summary
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Income</p>
                                    <p className="font-medium text-foreground">
                                        {formatCad(summary.annual_income)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Monthly income
                                    </p>
                                    <p className="font-medium text-foreground">
                                        {formatCad(summary.monthly_income)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Affordability band
                                    </p>
                                    <p className="font-medium text-foreground">
                                        {summary.affordability_band || "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Trade equity
                                    </p>
                                    <p className="font-medium text-foreground">
                                        {formatCad(summary.trade_equity)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Requested
                                    </p>
                                    <p className="font-medium text-foreground">
                                        {formatCad(summary.requested_amount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        OCR confidence
                                    </p>
                                    <p className="font-medium text-foreground">
                                        {app.ocr_confidence
                                            ? `${Math.round(app.ocr_confidence)}%`
                                            : "—"}
                                    </p>
                                </div>
                            </div>
                            {summary.risk_flags.length > 0 && (
                                <ul className="mt-3 space-y-1 text-xs text-amber-700">
                                    {summary.risk_flags.map((r) => (
                                        <li key={r}>• {r}</li>
                                    ))}
                                </ul>
                            )}
                            {!summary.ready && (
                                <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Missing for screening:{" "}
                                    {summary.missing_fields.join(", ")}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Submit to partner */}
                    <div className="rounded-lg border border-border bg-card p-5">
                        <h3 className="mb-2 text-sm font-semibold text-foreground">
                            Submit to screening partner
                        </h3>
                        <p className="mb-3 text-xs text-muted-foreground">
                            Marks this application as submitted to a configured
                            partner. FlashFender is not a lender network and never
                            forwards applications automatically.
                        </p>
                        {app.partner_submitted_at ? (
                            <p className="text-xs text-muted-foreground">
                                Reference: {app.partner_reference || "—"}
                            </p>
                        ) : (
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={submitting || !app.partner_channel_configured}
                                leftIcon={
                                    submitting ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Send className="h-3.5 w-3.5" />
                                    )
                                }
                                onClick={() => void submitToPartner()}
                            >
                                {submitting ? "Submitting…" : "Submit to partner"}
                            </Button>
                        )}
                        {!app.partner_channel_configured && (
                            <p className="mt-2 text-xs text-amber-700">
                                No screening partner is configured for this
                                dealership yet — the submit button is disabled.
                            </p>
                        )}
                    </div>

                    {/* Applicant details */}
                    <div className="rounded-lg border border-border bg-card p-5">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                            Applicant
                        </h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                            <Row label="Email" value={app.email || "—"} />
                            <Row label="Phone" value={app.phone || "—"} />
                            <Row label="DOB" value={app.date_of_birth || "—"} />
                            <Row label="Address" value={[app.address, app.city, app.province, app.postal_code].filter(Boolean).join(", ") || "—"} />
                            <Row label="Employer" value={app.employer || "—"} />
                            <Row label="Employment" value={app.employment_years ? `${app.employment_years} yrs` : "—"} />
                            <Row label="Rent" value={formatCad(app.monthly_rent)} />
                            <Row label="Vehicle" value={app.vehicle ? `${app.vehicle.year} ${app.vehicle.make} ${app.vehicle.model}` : "—"} />
                            <Row label="Created" value={new Date(app.created_at).toLocaleString()} />
                        </div>
                        {app.coapplicant_first_name && (
                            <>
                                <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Co-applicant
                                </h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                                    <Row label="Name" value={`${app.coapplicant_first_name} ${app.coapplicant_last_name || ""}`.trim()} />
                                    <Row label="Income" value={formatCad(app.coapplicant_annual_income)} />
                                    <Row label="Employer" value={app.coapplicant_employer || "—"} />
                                </div>
                            </>
                        )}
                        {app.notes && (
                            <p className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                {app.notes}
                            </p>
                        )}
                    </div>

                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        This summary is desk math for partner screening readiness
                        only — it is not an approval, a credit decision, or a
                        financing offer.
                    </p>
                </div>
            ) : null}
        </ListPageShell>
    );
}
