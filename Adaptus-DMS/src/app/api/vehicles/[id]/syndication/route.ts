import { NextRequest, NextResponse } from "next/server";
import {
    requireDealershipAccess,
    pickSupabaseClient,
    assertOwnershipOrDeny,
} from "@/src/lib/auth-helpers";
import {
    buildKijijiListingPack,
    kijijiPackToCsvRow,
} from "@/src/lib/syndication/kijiji";
import {
    autoTraderRowsToCsv,
    autoTraderRowsToPipeFeed,
    buildAutoTraderPackMeta,
    buildAutoTraderRow,
} from "@/src/lib/syndication/autotrader";
import {
    loadDealershipSyndicationContext,
    recordSyndicationExport,
    SYNDICATION_VEHICLE_SELECT,
    vehicleToAutoTraderInput,
} from "@/src/lib/syndication/helpers";

/**
 * Board listing / feed pack for one vehicle.
 *
 * GET /api/vehicles/[id]/syndication?board=kijiji|autotrader&format=json|csv|text|feed
 *
 * Kijiji: clipboard JSON/CSV/text (Wave C).
 * AutoTrader: AT.ca pipe feed or CSV — download only, no SFTP/auto-post.
 */
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

        let supabase;
        try {
            supabase = pickSupabaseClient(req, auth.profile).supabase;
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                error.message === "MISSING_BEARER_TOKEN"
            ) {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const { id } = await params;
        const url = new URL(req.url);
        const board = (url.searchParams.get("board") || "kijiji").toLowerCase();
        const format = (url.searchParams.get("format") || "json").toLowerCase();

        if (board !== "kijiji" && board !== "autotrader") {
            return NextResponse.json(
                {
                    error: "Supported boards: kijiji, autotrader",
                },
                { status: 400 }
            );
        }

        const { data: vehicle, error } = await supabase
            .from("vehicles")
            .select(SYNDICATION_VEHICLE_SELECT)
            .eq("id", id)
            .single();

        if (error || !vehicle) {
            return NextResponse.json(
                { error: "Vehicle not found" },
                { status: 404 }
            );
        }

        const deny = assertOwnershipOrDeny(vehicle, auth.profile);
        if (deny) return deny;

        const dealershipId =
            (vehicle.dealership_id as string | null) ||
            auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json(
                { error: "Dealership required" },
                { status: 400 }
            );
        }

        const ctx = await loadDealershipSyndicationContext(
            supabase,
            dealershipId
        );

        if (board === "kijiji") {
            const pack = buildKijijiListingPack(vehicle, {
                city: ctx.city,
                province: ctx.province,
            });

            if (format === "csv") {
                return new NextResponse(kijijiPackToCsvRow(pack), {
                    status: 200,
                    headers: {
                        "Content-Type": "text/csv; charset=utf-8",
                        "Content-Disposition": `attachment; filename="kijiji-${vehicle.vin}.csv"`,
                    },
                });
            }

            if (format === "text") {
                return new NextResponse(pack.body_text, {
                    status: 200,
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Content-Disposition": `attachment; filename="kijiji-${vehicle.vin}.txt"`,
                    },
                });
            }

            return NextResponse.json({
                data: pack,
                meta: {
                    board: "kijiji",
                    honest_mvp: true,
                    note: "Copy or download — AdaptUs does not auto-post to Kijiji without marketplace credentials.",
                },
            });
        }

        // AutoTrader Canada
        const row = buildAutoTraderRow(
            vehicleToAutoTraderInput(vehicle as Record<string, unknown>),
            ctx.autotrader
        );

        if (!row.ok && format !== "json") {
            return NextResponse.json(
                {
                    error: "Vehicle is missing required AutoTrader fields",
                    issues: row.issues,
                    meta: buildAutoTraderPackMeta([row]),
                },
                { status: 422 }
            );
        }

        if (format === "feed" || format === "txt" || format === "pipe") {
            const body = autoTraderRowsToPipeFeed([row]);
            await recordSyndicationExport(supabase, dealershipId, ctx.settings, {
                board: "autotrader",
                included: 1,
                skipped: 0,
                vins: [row.vin],
            });
            return new NextResponse(body + (body ? "\n" : ""), {
                status: 200,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Content-Disposition": `attachment; filename="autotrader-ca-${vehicle.vin}.txt"`,
                },
            });
        }

        if (format === "csv") {
            const body = autoTraderRowsToCsv([row]);
            await recordSyndicationExport(supabase, dealershipId, ctx.settings, {
                board: "autotrader",
                included: 1,
                skipped: 0,
                vins: [row.vin],
            });
            return new NextResponse(body + "\n", {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="autotrader-ca-${vehicle.vin}.csv"`,
                },
            });
        }

        return NextResponse.json({
            data: {
                board: "autotrader",
                columns: row.values,
                row,
            },
            meta: buildAutoTraderPackMeta([row]),
        });
    } catch (error: unknown) {
        console.error("Error building syndication pack:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to build listing pack",
            },
            { status: 500 }
        );
    }
}
