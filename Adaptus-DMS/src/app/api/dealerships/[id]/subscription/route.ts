// app/api/dealerships/[id]/subscription/route.ts
import { requireDealershipAccess, requirePlatformAdmin } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

// GET subscription for a dealership — platform admin or own dealership member
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const auth = await requireDealershipAccess(req, id);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const supabase = supabaseAdmin;

        const { data: subscription, error: dbError } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("dealership_id", id)
            .single();

        if (dbError && dbError.code !== 'PGRST116') {
            throw dbError;
        }

        return NextResponse.json({ data: subscription || null });
    } catch (error: unknown) {
        console.error("Error fetching subscription:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update subscription for a dealership (platform admin only)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const payload = await req.json();
        const {
            plan_name,
            plan_price,
            billing_cycle,
            status,
            features,
            limits,
            trial_ends_at,
            current_period_start,
            current_period_end
        } = payload;

        // Check if subscription exists
        // Use service role: platform admin needs to bypass subscriptions RLS
        // for the upsert path. The route is already gated on is_platform_admin.
        const { data: existingSub } = await supabaseAdmin
            .from("subscriptions")
            .select("id")
            .eq("dealership_id", id)
            .single();

        const updateData: Record<string, unknown> = {};
        if (plan_name !== undefined) updateData.plan_name = plan_name;
        if (plan_price !== undefined) updateData.plan_price = plan_price;
        if (billing_cycle !== undefined) updateData.billing_cycle = billing_cycle;
        if (status !== undefined) updateData.status = status;
        if (features !== undefined) updateData.features = features;
        if (limits !== undefined) updateData.limits = limits;
        if (trial_ends_at !== undefined) updateData.trial_ends_at = trial_ends_at;
        if (current_period_start !== undefined) updateData.current_period_start = current_period_start;
        if (current_period_end !== undefined) updateData.current_period_end = current_period_end;

        let subscription;

        if (existingSub) {
            // Update existing subscription
            const { data, error: dbError } = await supabaseAdmin
                .from("subscriptions")
                .update(updateData)
                .eq("dealership_id", id)
                .select()
                .single();

            if (dbError) throw dbError;
            subscription = data;
        } else {
            // Create new subscription
            const { data, error: dbError } = await supabaseAdmin
                .from("subscriptions")
                .insert({
                    dealership_id: id,
                    ...updateData
                })
                .select()
                .single();

            if (dbError) throw dbError;
            subscription = data;
        }

        return NextResponse.json({ data: subscription });
    } catch (error: unknown) {
        console.error("Error updating subscription:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
