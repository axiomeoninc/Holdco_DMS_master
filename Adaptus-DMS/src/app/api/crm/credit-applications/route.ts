// Credit applications — capture + partner-led screening (NOT a lender network).
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

export async function GET(req: NextRequest) {
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

        const url = new URL(req.url);
        const status = url.searchParams.get("status");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50") || 50, 200);
        const offset = parseInt(url.searchParams.get("offset") || "0") || 0;

        let query = supabaseAdmin
            .from("credit_applications")
            .select(
                `*,
                 customer:customers(id, name, email, phone),
                 vehicle:vehicles(id, year, make, model, stock_number)`,
                { count: "exact" }
            )
            .eq("dealership_id", dealershipId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq("status", status);

        const { data, count, error } = await query;
        if (error) throw error;

        const rows = (data ?? []).map((row) => {
            const summary = computeScreeningSummary(row as CreditApplicationInput);
            return {
                ...row,
                screening_summary: row.screening_summary && Object.keys(row.screening_summary).length
                    ? row.screening_summary
                    : summary,
            };
        });

        return NextResponse.json({ data: rows, count: count || 0 });
    } catch (error: unknown) {
        console.error("[crm/credit-applications] GET", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load applications" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
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

        const body = (await req.json()) as Record<string, unknown>;

        let customerId = pickString(body.customer_id);
        let customerPrefill: Record<string, unknown> = {};
        if (customerId) {
            const { data: customer } = await supabaseAdmin
                .from("customers")
                .select("name, email, phone, address, city, province, postal_code")
                .eq("id", customerId)
                .eq("dealership_id", dealershipId)
                .maybeSingle();
            if (customer) {
                customerPrefill = customer;
            } else {
                customerId = null;
            }
        }

        const input: CreditApplicationInput = {
            first_name: pickString(body.first_name),
            last_name: pickString(body.last_name),
            date_of_birth: pickString(body.date_of_birth),
            email: pickString(body.email),
            phone: pickString(body.phone),
            address: pickString(body.address),
            city: pickString(body.city),
            province: pickString(body.province),
            postal_code: pickString(body.postal_code),
            employer: pickString(body.employer),
            employment_years: pickNumber(body.employment_years),
            annual_income: pickNumber(body.annual_income),
            monthly_rent: pickNumber(body.monthly_rent),
            desired_vehicle_id: pickString(body.desired_vehicle_id),
            requested_amount: pickNumber(body.requested_amount),
            trade_in_value: pickNumber(body.trade_in_value),
            trade_in_payoff: pickNumber(body.trade_in_payoff),
            coapplicant_first_name: pickString(body.coapplicant_first_name),
            coapplicant_last_name: pickString(body.coapplicant_last_name),
            coapplicant_annual_income: pickNumber(body.coapplicant_annual_income),
            coapplicant_employer: pickString(body.coapplicant_employer),
            notes: pickString(body.notes),
        };

        // CRM prefill: when the customer is known but fields were left blank,
        // carry over known customer data (honest prefill, never auto-decided).
        if (customerId) {
            if (!input.first_name) {
                const name = (customerPrefill.name as string) || "";
                const parts = name.trim().split(/\s+/);
                if (parts[0]) input.first_name = parts[0];
                if (parts.length > 1) input.last_name = parts[parts.length - 1];
            }
            if (!input.email) input.email = pickString(customerPrefill.email);
            if (!input.phone) input.phone = pickString(customerPrefill.phone);
            if (!input.address) input.address = pickString(customerPrefill.address);
            if (!input.city) input.city = pickString(customerPrefill.city);
            if (!input.province) input.province = pickString(customerPrefill.province);
            if (!input.postal_code) input.postal_code = pickString(customerPrefill.postal_code);
        }

        const summary = computeScreeningSummary(input);

        // Partner channel check — honest amber state only.
        const { data: channels } = await supabaseAdmin
            .from("credit_partner_channels")
            .select("id")
            .eq("dealership_id", dealershipId)
            .eq("configured", true)
            .limit(1);
        const partnerConfigured = Array.isArray(channels) && channels.length > 0;

        const { data, error } = await supabaseAdmin
            .from("credit_applications")
            .insert({
                dealership_id: dealershipId,
                customer_id: customerId,
                lead_id: pickString(body.lead_id),
                status: summary.ready ? "screening_ready" : "draft",
                first_name: input.first_name,
                last_name: input.last_name,
                date_of_birth: input.date_of_birth,
                email: input.email,
                phone: input.phone,
                address: input.address,
                city: input.city,
                province: input.province,
                postal_code: input.postal_code,
                employer: input.employer,
                employment_years: input.employment_years,
                annual_income: input.annual_income,
                monthly_rent: input.monthly_rent,
                desired_vehicle_id: input.desired_vehicle_id,
                requested_amount: input.requested_amount,
                trade_in_value: input.trade_in_value,
                trade_in_payoff: input.trade_in_payoff,
                coapplicant_first_name: input.coapplicant_first_name,
                coapplicant_last_name: input.coapplicant_last_name,
                coapplicant_annual_income: input.coapplicant_annual_income,
                coapplicant_employer: input.coapplicant_employer,
                ocr_confidence: pickNumber(body.ocr_confidence),
                partner_channel_configured: partnerConfigured,
                screening_summary: summary as unknown as object,
                notes: input.notes,
                created_by: auth.profile.id,
            })
            .select("*")
            .single();
        if (error) throw error;

        return NextResponse.json(
            {
                data: {
                    ...data,
                    screening_summary: summary,
                    partner_channel_configured: partnerConfigured,
                },
                partner_note: partnerConfigured
                    ? "Partner channel configured — application can be submitted for screening."
                    : "No screening partner configured — application stored for manual handling.",
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("[crm/credit-applications] POST", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to save application" },
            { status: 500 }
        );
    }
}
