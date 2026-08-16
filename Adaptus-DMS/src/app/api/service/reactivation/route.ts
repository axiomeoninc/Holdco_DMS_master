// Service reactivation candidates — INFORMATIONAL ONLY.
// Surfaces customers whose most recent service is older than a threshold AND
// who have explicitly consented to service contact. Nothing here sends mail
// or SMS; it only lists who the desk could call.
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    buildReactivationCandidates,
    DEFAULT_REACTIVATION_DAYS,
    type ServiceType,
} from "@/src/lib/service";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const dealershipId = auth.profile.is_platform_admin
            ? (new URL(req.url).searchParams.get("dealership_id") || auth.profile.dealership_id)
            : auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const url = new URL(req.url);
        const thresholdRaw = parseInt(url.searchParams.get("days") || "", 10);
        const thresholdDays =
            !Number.isNaN(thresholdRaw) && thresholdRaw > 0
                ? thresholdRaw
                : DEFAULT_REACTIVATION_DAYS;
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
        const locationId = url.searchParams.get("location_id") || url.searchParams.get("locationId");

        // Service history joined with customer consent. Consent filter is applied
        // here (server-side) so the desk can never see non-consented customers.
        let query = supabaseAdmin
            .from("service_records")
            .select(
                `
                service_date,
                service_type,
                customer_id,
                status,
                customer:customers(id, name, email, phone, service_contact_consent, marketing_consent)
            `,
                { count: "exact" }
            )
            .eq("dealership_id", dealershipId)
            .order("service_date", { ascending: false });

        if (locationId) query = query.eq("location_id", locationId);

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []).flatMap((row) => {
            const r = row as {
                service_date: string;
                service_type: ServiceType | null;
                customer_id: string | null;
                customer?:
                    | Array<{
                          id: string;
                          name: string;
                          email: string | null;
                          phone: string | null;
                          service_contact_consent: boolean | null;
                      }>
                    | {
                          id: string;
                          name: string;
                          email: string | null;
                          phone: string | null;
                          service_contact_consent: boolean | null;
                      }
                    | null;
            };
            const customer = Array.isArray(r.customer) ? r.customer[0] : r.customer;
            if (!r.customer_id || !customer) return [];
            return [
                {
                    service_date: r.service_date,
                    service_type: r.service_type,
                    customer_id: r.customer_id,
                    customer_name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    service_contact_consent:
                        customer.service_contact_consent === true,
                    vehicle_label: null,
                },
            ];
        });

        const candidates = buildReactivationCandidates(rows, { thresholdDays });

        return NextResponse.json({
            data: candidates.slice(0, limit),
            count: candidates.length,
            threshold_days: thresholdDays,
            informational: true,
            note: "Informational list only — no messages are sent automatically.",
        });
    } catch (error: unknown) {
        console.error("Error fetching reactivation candidates:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
