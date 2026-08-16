import { NextRequest, NextResponse } from "next/server";
import { getCarfaxEnv, fetchCarfaxReportForVin } from "@/src/lib/carfax";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    requireDealershipAccess,
    assertOwnershipOrDeny,
} from "@/src/lib/auth-helpers";
import { readExplicitDealershipId } from "@/src/lib/platform-rooftop";
import {
    VIN_LOOKUP_NEEDS_ACT_AS,
    VIN_LOOKUP_NO_CONTEXT,
} from "@/src/lib/vehicle-lookup";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        const url = new URL(req.url);
        const vehicleId = url.searchParams.get("vehicle_id");
        const vin = url.searchParams.get("vin");
        const includeStatus = url.searchParams.get("status") === "1";

        let query = supabase
            .from("carfax_reports")
            .select("*")
            .order("created_at", { ascending: false });

        const rooftop = auth.profile.is_platform_admin
            ? (readExplicitDealershipId(req) ?? auth.profile.dealership_id)
            : auth.profile.dealership_id;
        if (!rooftop) {
            return NextResponse.json(
                {
                    error: auth.profile.is_platform_admin
                        ? VIN_LOOKUP_NEEDS_ACT_AS
                        : VIN_LOOKUP_NO_CONTEXT,
                },
                { status: auth.profile.is_platform_admin ? 400 : 403 }
            );
        }
        query = query.eq("dealership_id", rooftop);

        if (vehicleId) {
            query = query.eq("vehicle_id", vehicleId);
        }
        if (vin) {
            query = query.eq("vin", vin);
        }

        const { data, error } = await query;
        if (error) throw error;

        const body: Record<string, unknown> = { data };
        if (includeStatus) {
            body.env = getCarfaxEnv();
        }
        return NextResponse.json(body);
    } catch (error) {
        console.error("Error fetching Carfax reports:", error);
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }
}

/**
 * Attach or create a carfax_reports row.
 * Body: { vehicle_id?, vin, report_url?, action?: "attach" | "fetch" }
 * action=fetch uses partner env when present; never invents keys.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        const body = await req.json();
        const vin = typeof body.vin === "string" ? body.vin.trim().toUpperCase() : "";
        const vehicleId = typeof body.vehicle_id === "string" ? body.vehicle_id : null;
        const action = body.action === "fetch" ? "fetch" : "attach";

        if (!vin) {
            return NextResponse.json({ error: "vin is required" }, { status: 400 });
        }

        // Verify vehicle ownership before mirroring URL onto vehicles row.
        if (vehicleId) {
            const { data: vehicle, error: vErr } = await supabase
                .from("vehicles")
                .select("id, dealership_id, vin")
                .eq("id", vehicleId)
                .maybeSingle();
            if (vErr || !vehicle) {
                return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
            }
            const deny = assertOwnershipOrDeny(vehicle, auth.profile);
            if (deny) return deny;
        }

        let reportUrl: string | null =
            typeof body.report_url === "string" && body.report_url.trim()
                ? body.report_url.trim()
                : null;
        let reportData: Record<string, unknown> | null = null;
        let ownershipCount: number | null = null;
        let accidentCount: number | null = null;
        let titleStatus: string | null = null;
        let source: string = "manual";

        if (action === "fetch") {
            const fetched = await fetchCarfaxReportForVin(vin);
            if (!fetched.ok) {
                const status = fetched.code === "missing_env" ? 503 : 400;
                return NextResponse.json(
                    {
                        error: fetched.message,
                        code: fetched.code,
                        missing: fetched.missing || [],
                        env: getCarfaxEnv(),
                    },
                    { status }
                );
            }
            reportUrl = fetched.report_url;
            source = fetched.source;
            reportData = fetched.report_data || null;
            ownershipCount = fetched.ownership_count ?? null;
            accidentCount = fetched.accident_count ?? null;
            titleStatus = fetched.title_status ?? null;
        }

        if (!reportUrl) {
            return NextResponse.json(
                { error: "report_url is required when action is attach" },
                { status: 400 }
            );
        }

        const row = {
            vehicle_id: vehicleId,
            vin,
            report_url: reportUrl,
            report_data: reportData
                ? { ...reportData, _source: source }
                : { _source: source },
            ownership_count: ownershipCount,
            accident_count: accidentCount,
            title_status: titleStatus,
            last_updated: new Date().toISOString(),
            dealership_id: auth.profile.dealership_id || null,
        };

        const { data, error } = await supabase
            .from("carfax_reports")
            .insert(row)
            .select()
            .single();

        if (error) throw error;

        // Mirror primary URL onto vehicle when we have an id (ownership already checked)
        if (vehicleId) {
            await supabase
                .from("vehicles")
                .update({ carfax_report_url: reportUrl })
                .eq("id", vehicleId);
        }

        return NextResponse.json({ data, env: getCarfaxEnv() }, { status: 201 });
    } catch (error) {
        console.error("Error creating Carfax report:", error);
        return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }
}
