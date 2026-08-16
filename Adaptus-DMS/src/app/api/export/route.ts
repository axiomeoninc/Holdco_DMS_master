import { NextRequest, NextResponse } from "next/server";
import {
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import {
    gatherDealershipExport,
    toJsonBuffer,
    toXlsxBuffer,
} from "@/src/lib/export";
import { appOrigin } from "@/src/lib/casl-unsubscribe";
import { nonEmptyDealershipId } from "@/src/lib/platform-rooftop";

/**
 * One-click full dealership data export.
 * GET ?format=json|xlsx (default json) → file download attachment.
 * Admin/Manager only.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const isAdmin =
            auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const url = new URL(req.url);
        const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "json";

        const rooftop = nonEmptyDealershipId(auth.dealership_id);
        if (!rooftop) {
            return NextResponse.json(
                { error: "Dealership required" },
                { status: 400 }
            );
        }

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const bundle = await gatherDealershipExport(supabase, rooftop);

        if (format === "xlsx") {
            const buffer = await toXlsxBuffer(bundle);
            return new NextResponse(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="flashfender-export-${rooftop.slice(0, 8)}.xlsx"`,
                    "Cache-Control": "no-store",
                },
            });
        }

        const buffer = toJsonBuffer(bundle);
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                    "Content-Disposition": `attachment; filename="flashfender-export-${rooftop.slice(0, 8)}.json"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: unknown) {
        console.error("Export error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Export failed",
            },
            { status: 500 }
        );
    }
}

/** POST returns the export as JSON in the response body (for the settings UI). */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const isAdmin =
            auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const rooftop = nonEmptyDealershipId(auth.dealership_id);
        if (!rooftop) {
            return NextResponse.json(
                { error: "Dealership required" },
                { status: 400 }
            );
        }
        const bundle = await gatherDealershipExport(supabase, rooftop);

        const counts = {
            vehicles: bundle.vehicles.length,
            customers: bundle.customers.length,
            leads: bundle.leads.length,
            deals: bundle.deals.length,
            quotations: bundle.quotations.length,
            invoices: bundle.invoices.length,
        };

        return NextResponse.json({
            data: {
                generated_at: bundle.generated_at,
                counts,
                download_json: `${appOrigin()}/api/export?format=json`,
                download_xlsx: `${appOrigin()}/api/export?format=xlsx`,
            },
            message:
                "Export ready. Use the download links (authenticated) or the JSON below.",
        });
    } catch (error: unknown) {
        console.error("Export (POST) error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Export failed",
            },
            { status: 500 }
        );
    }
}
