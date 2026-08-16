// Review requests — list + create. Creation checks marketing consent and the
// dealership's review automation config. Auto-send only fires when enabled +
// Resend configured + consent present; otherwise the request stays "draft"
// (amber) — never a fake "sent".
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    getReviewConfig,
    newReviewToken,
    attemptSendReviewRequest,
} from "@/src/lib/reviews";

const SELECT_COLS = `
    *,
    customer:customers(id, name, email, phone),
    deal:sales_deals(id, deal_date, vehicle:vehicles(id, year, make, model))
`;

function shapeRow(row: Record<string, unknown>) {
    return {
        ...row,
        customer: row.customer ?? null,
        deal: row.deal ?? null,
    } as Record<string, unknown> & {
        id: string;
        status: string;
        consent_ok: boolean;
        customer: Record<string, unknown> | null;
        deal: Record<string, unknown> | null;
    };
}

function reviewUrl(origin: string, token: string): string {
    return `${origin}/review/${token}`;
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
        const dealershipId = auth.profile.is_platform_admin
            ? (new URL(req.url).searchParams.get("dealership_id") || auth.profile.dealership_id)
            : auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const url = new URL(req.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const status = url.searchParams.get("status");
        const customerId = url.searchParams.get("customer_id");
        const locationId = url.searchParams.get("location_id") || url.searchParams.get("locationId");

        let query = supabaseAdmin
            .from("review_requests")
            .select(SELECT_COLS, { count: "exact" })
            .eq("dealership_id", dealershipId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq("status", status);
        if (customerId) query = query.eq("customer_id", customerId);
        if (locationId) query = query.eq("location_id", locationId);

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: (data || []).map((row) => shapeRow(row as Record<string, unknown>)),
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        console.error("Error fetching review requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
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
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json();
        const targetDealership =
            auth.profile.is_platform_admin && typeof body.dealership_id === "string"
                ? body.dealership_id
                : dealershipId;
        if (!targetDealership) {
            return NextResponse.json({ error: "dealership_id required" }, { status: 400 });
        }

        const customerId = typeof body.customer_id === "string" ? body.customer_id : null;
        const dealId = typeof body.deal_id === "string" ? body.deal_id : null;
        if (!customerId) {
            return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
        }

        // Customer must exist in this dealership and have marketing consent.
        const { data: customer, error: customerErr } = await supabaseAdmin
            .from("customers")
            .select("id, name, email, phone, marketing_consent")
            .eq("id", customerId)
            .eq("dealership_id", targetDealership)
            .maybeSingle();
        if (customerErr) throw customerErr;
        if (!customer) {
            return NextResponse.json(
                { error: "Customer not found in this dealership" },
                { status: 404 }
            );
        }

        // Deal (optional) must also belong to this dealership.
        if (dealId) {
            const { data: deal, error: dealErr } = await supabaseAdmin
                .from("sales_deals")
                .select("id, dealership_id, deal_date, vehicle_id")
                .eq("id", dealId)
                .maybeSingle();
            if (dealErr) throw dealErr;
            if (!deal || deal.dealership_id !== targetDealership) {
                return NextResponse.json({ error: "Deal not found" }, { status: 404 });
            }
        }

        const config = await getReviewConfig(targetDealership);
        const consentOk = customer.marketing_consent === true;

        // If automation is off OR consent missing, the request is recorded as a
        // draft (informational) but never marked sent.
        const token = newReviewToken();
        const { data: dealershipRow } = await supabaseAdmin
            .from("dealerships")
            .select("name, business_name")
            .eq("id", targetDealership)
            .maybeSingle();
        const dealershipName = dealershipRow?.business_name || dealershipRow?.name || "the dealership";

        const origin = new URL(req.url).origin;
        const reviewUrlValue = reviewUrl(origin, token);

        const { data: request, error: insertErr } = await supabaseAdmin
            .from("review_requests")
            .insert({
                dealership_id: targetDealership,
                location_id:
                    typeof body.location_id === "string" && body.location_id.trim()
                        ? body.location_id.trim()
                        : null,
                customer_id: customerId,
                deal_id: dealId,
                token,
                status: config.enabled && consentOk ? "queued" : "draft",
                consent_ok: consentOk,
                review_url: reviewUrlValue,
                channel: "email",
                created_by: auth.profile.id,
            })
            .select(SELECT_COLS)
            .single();
        if (insertErr) throw insertErr;

        const record = shapeRow(request as Record<string, unknown>);

        // Honest auto-send attempt.
        if (record.status === "queued") {
            const sendResult = await attemptSendReviewRequest({
                dealershipId: targetDealership,
                customerEmail: customer.email || "",
                requestId: record.id,
                token,
                config,
                reviewUrl: reviewUrlValue,
                customerName: customer.name,
                dealershipName,
                vehicleLabel: null,
            });

            if (sendResult.sent) {
                await supabaseAdmin
                    .from("review_requests")
                    .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
                    .eq("id", record.id);
                record.status = "sent";
            } else if (!sendResult.ok) {
                await supabaseAdmin
                    .from("review_requests")
                    .update({ status: "draft", last_error: sendResult.error })
                    .eq("id", record.id);
                record.status = "draft";
            } else {
                // ok but not sent (e.g. Resend unconfigured, auto-send off at
                // time of create) — stays queued/draft per reason.
                const reason = sendResult.reason;
                const fallbackStatus =
                    reason === "auto_send_disabled" || reason === "resend_not_configured"
                        ? "draft"
                        : "draft";
                await supabaseAdmin
                    .from("review_requests")
                    .update({ status: fallbackStatus, last_error: reason })
                    .eq("id", record.id);
                record.status = fallbackStatus;
            }
        }

        return NextResponse.json(
            {
                data: record,
                sent: record.status === "sent",
                note:
                    record.status === "sent"
                        ? "Review request sent."
                        : record.consent_ok
                          ? "Review request created as a draft. Enable auto-send and ensure Resend is configured to send automatically."
                          : "Review request created as a draft — the customer has not given marketing consent, so nothing will be sent.",
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Error creating review request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
