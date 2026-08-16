// POST /api/leads/[id]/log-call — log a phone call engagement
import { NextRequest, NextResponse } from "next/server";
import {
    assertOwnershipOrDeny,
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { scoreLead } from "@/src/lib/business/lead-score";

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

        const perms = auth.profile.user_permissions || [];
        const canWrite =
            auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager" ||
            perms.includes("leads:write") ||
            perms.includes("*");

        if (!canWrite) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        let supabase;
        try {
            supabase = pickSupabaseClient(req, auth.profile).supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            note?: string;
            outcome?: string;
        };

        const { data: lead, error: leadError } = await supabase
            .from("leads")
            .select("*")
            .eq("id", id)
            .single();

        if (leadError || !lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const deny = assertOwnershipOrDeny(lead, auth.profile);
        if (deny) return deny;

        const now = new Date().toISOString();
        const stamp = new Date().toLocaleString("en-CA");
        const callLine = [
            `[Call ${stamp}]`,
            body.outcome ? `Outcome: ${body.outcome}` : null,
            body.note?.trim() || null,
            `Logged by ${auth.user?.email || "user"}`,
        ]
            .filter(Boolean)
            .join(" — ");

        const notes = lead.notes ? `${lead.notes}\n${callLine}` : callLine;

        const scored = scoreLead({
            source: lead.source,
            status: lead.status,
            last_engagement: now,
            lead_creation_date: lead.lead_creation_date,
            created_at: lead.created_at,
            interest_vehicle_id: lead.interest_vehicle_id,
            notes,
        });

        const { data, error } = await supabase
            .from("leads")
            .update({
                last_engagement: now,
                notes,
                score: scored.score,
                temperature: scored.temperature,
            })
            .eq("id", id)
            .select(
                `*,
                customer:customers(*),
                vehicle:vehicles(*),
                assigned_user:users!assigned_to(id, full_name, email, avatar)`
            )
            .single();

        if (error) throw error;

        return NextResponse.json({
            data,
            meta: { scored, logged_at: now },
        });
    } catch (error: unknown) {
        console.error("log-call POST:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 }
        );
    }
}
