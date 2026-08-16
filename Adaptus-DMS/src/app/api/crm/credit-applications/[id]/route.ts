// Credit application detail + updates.
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    computeScreeningSummary,
    type CreditApplicationInput,
} from "@/src/lib/credit/credit-app";

function pickString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }
        const { id } = await params;

        const { data, error } = await supabaseAdmin
            .from("credit_applications")
            .select(
                `*,
                 customer:customers(id, name, email, phone),
                 vehicle:vehicles(id, year, make, model, stock_number, retail_price)`
            )
            .eq("id", id)
            .eq("dealership_id", dealershipId)
            .maybeSingle();
        if (error) throw error;
        if (!data) {
            return NextResponse.json(
                { error: "Credit application not found" },
                { status: 404 }
            );
        }

        const summary = computeScreeningSummary(data as CreditApplicationInput);

        return NextResponse.json({
            data: {
                ...data,
                screening_summary:
                    data.screening_summary && Object.keys(data.screening_summary).length
                        ? data.screening_summary
                        : summary,
            },
        });
    } catch (error: unknown) {
        console.error("[crm/credit-applications] GET", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load application" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "No dealership context" },
                { status: 400 }
            );
        }
        const { id } = await params;
        const body = (await req.json()) as Record<string, unknown>;

        const { data: existing, error: findErr } = await supabaseAdmin
            .from("credit_applications")
            .select("*")
            .eq("id", id)
            .eq("dealership_id", dealershipId)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) {
            return NextResponse.json(
                { error: "Credit application not found" },
                { status: 404 }
            );
        }

        const merged: CreditApplicationInput = {
            first_name: pickString(body.first_name ?? existing.first_name),
            last_name: pickString(body.last_name ?? existing.last_name),
            date_of_birth: pickString(body.date_of_birth ?? existing.date_of_birth),
            email: pickString(body.email ?? existing.email),
            phone: pickString(body.phone ?? existing.phone),
            address: pickString(body.address ?? existing.address),
            city: pickString(body.city ?? existing.city),
            province: pickString(body.province ?? existing.province),
            postal_code: pickString(body.postal_code ?? existing.postal_code),
            employer: pickString(body.employer ?? existing.employer),
            employment_years: pickNumber(body.employment_years ?? existing.employment_years),
            annual_income: pickNumber(body.annual_income ?? existing.annual_income),
            monthly_rent: pickNumber(body.monthly_rent ?? existing.monthly_rent),
            requested_amount: pickNumber(body.requested_amount ?? existing.requested_amount),
            trade_in_value: pickNumber(body.trade_in_value ?? existing.trade_in_value),
            trade_in_payoff: pickNumber(body.trade_in_payoff ?? existing.trade_in_payoff),
            coapplicant_first_name: pickString(body.coapplicant_first_name ?? existing.coapplicant_first_name),
            coapplicant_last_name: pickString(body.coapplicant_last_name ?? existing.coapplicant_last_name),
            coapplicant_annual_income: pickNumber(body.coapplicant_annual_income ?? existing.coapplicant_annual_income),
            coapplicant_employer: pickString(body.coapplicant_employer ?? existing.coapplicant_employer),
            notes: pickString(body.notes ?? existing.notes),
        };

        const summary = computeScreeningSummary(merged);
        const patch: Record<string, unknown> = {
            ...merged,
            date_of_birth: merged.date_of_birth,
            screening_summary: summary,
        };
        if (body.status && typeof body.status === "string") {
            const valid = ["draft", "screening_ready", "submitted", "decision_received", "cancelled"];
            if (valid.includes(body.status)) patch.status = body.status;
        }

        const { data, error } = await supabaseAdmin
            .from("credit_applications")
            .update(patch)
            .eq("id", id)
            .eq("dealership_id", dealershipId)
            .select("*")
            .single();
        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("[crm/credit-applications] PATCH", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Update failed" },
            { status: 500 }
        );
    }
}
