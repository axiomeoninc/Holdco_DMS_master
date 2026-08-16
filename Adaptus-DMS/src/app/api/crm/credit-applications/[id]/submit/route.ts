// Submit a credit application to a partner for screening.
// Honest gate: only works when the dealership has a configured partner channel.
// Explicitly NOT a lender network — this marks the local record as submitted.
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(
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

        const { data: app, error: findErr } = await supabaseAdmin
            .from("credit_applications")
            .select("*")
            .eq("id", id)
            .eq("dealership_id", dealershipId)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!app) {
            return NextResponse.json(
                { error: "Credit application not found" },
                { status: 404 }
            );
        }

        if (app.status === "submitted") {
            return NextResponse.json({
                data: app,
                message: "Already marked submitted to partner.",
            });
        }

        const { data: channels } = await supabaseAdmin
            .from("credit_partner_channels")
            .select("id, name")
            .eq("dealership_id", dealershipId)
            .eq("configured", true)
            .limit(1);

        const channel = Array.isArray(channels) ? channels[0] : undefined;
        if (!channel) {
            return NextResponse.json(
                {
                    error:
                        "No screening partner configured for this dealership. Configure a partner channel first — nothing is submitted automatically.",
                    code: "credit_partner_not_configured",
                    amber: true,
                },
                { status: 422 }
            );
        }

        const now = new Date().toISOString();
        const { data, error } = await supabaseAdmin
            .from("credit_applications")
            .update({
                status: "submitted",
                partner_submitted_at: now,
                partner_reference: `partner:${channel.id}:stub`,
            })
            .eq("id", id)
            .eq("dealership_id", dealershipId)
            .select("*")
            .single();
        if (error) throw error;

        return NextResponse.json({
            data,
            message: `Marked submitted to ${channel.name}. Screening results are handled by the partner — none are created inside FlashFender.`,
        });
    } catch (error: unknown) {
        console.error("[crm/credit-applications] submit", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Submit failed" },
            { status: 500 }
        );
    }
}
