// app/api/compliance-pack/route.ts
// GET ?deal_id= | ?vehicle_id= — compliance document pack:
//   We Owe + Buyer's Guide + Known-Damage Disclosure (single PDF).
// Uses the existing MVDA known-damage fields (vehicles.known_damage / disclosure)
// and bill-of-sale data when available.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    assertOwnershipOrDeny,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import {
    buildBuyersGuidePdfBytes,
    buildCompliancePackPdfBytes,
    buildKnownDamageDisclosurePdfBytes,
    buildWeOwePdfBytes,
} from "@/src/lib/audit";
import { logAudit } from "@/src/lib/audit";
import { assertDamageDisclosureForPublish } from "@/src/lib/mvda-damage";

type Supabase = typeof supabaseAdmin;

async function fetchDealership(
    supabase: Supabase,
    dealershipId: string | null
): Promise<{ name?: string | null; business_name?: string | null; business_address?: string | null; business_phone?: string | null; dealer_license?: string | null } | null> {
    if (!dealershipId) return null;
    const { data } = await supabase
        .from("dealerships")
        .select("name, business_name, business_address, business_phone, dealer_license")
        .eq("id", dealershipId)
        .single();
    return (data || null) as never;
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const url = new URL(req.url);
        const dealId = url.searchParams.get("deal_id");
        const vehicleId = url.searchParams.get("vehicle_id");

        if (!dealId && !vehicleId) {
            return NextResponse.json(
                { error: "Provide deal_id or vehicle_id" },
                { status: 400 }
            );
        }

        const supabase = supabaseAdmin;
        const dealership = await fetchDealership(
            supabase,
            auth.profile.dealership_id
        );
        const dealer = {
            name: dealership?.name ?? null,
            business_name: dealership?.business_name ?? null,
            business_address: dealership?.business_address ?? null,
            business_phone: dealership?.business_phone ?? null,
            dealer_license: dealership?.dealer_license ?? null,
        };

        let vehicle: {
            id: string;
            vin: string;
            year: number;
            make: string;
            model: string;
            odometer?: number | null;
            known_damage: boolean;
            disclosure?: string | null;
        } | null = null;
        let customer: { name?: string | null } | null = null;
        let weOweItems: string[] = [];

        if (dealId) {
            const { data: deal, error } = await supabase
                .from("sales_deals")
                .select(
                    "id, dealership_id, vehicle:vehicles(id, vin, year, make, model, odometer, known_damage, disclosure), customer:customers(name)"
                )
                .eq("id", dealId)
                .single();
            if (error) {
                return NextResponse.json(
                    { error: error.code === "PGRST116" ? "Deal not found" : error.message },
                    { status: error.code === "PGRST116" ? 404 : 500 }
                );
            }
            const deny = assertOwnershipOrDeny(deal, auth.profile);
            if (deny) return deny;
            const v = Array.isArray(deal.vehicle) ? deal.vehicle[0] : deal.vehicle;
            const c = Array.isArray(deal.customer) ? deal.customer[0] : deal.customer;
            vehicle = v || null;
            customer = c || null;

            // We-owe items default to an honest, generic statement when no BOS
            // lists specific outstanding items.
            const { data: bos } = await supabase
                .from("bill_of_sale")
                .select("notes, total_balance_due")
                .eq("deal_id", dealId)
                .maybeSingle();
            if (bos?.notes?.trim()) {
                weOweItems = [bos.notes.trim()];
            } else {
                weOweItems = ["(no outstanding we-owe items recorded on the bill of sale)"];
            }
        } else if (vehicleId) {
            const { data: v, error } = await supabase
                .from("vehicles")
                .select("id, dealership_id, vin, year, make, model, odometer, known_damage, disclosure")
                .eq("id", vehicleId)
                .single();
            if (error) {
                return NextResponse.json(
                    { error: error.code === "PGRST116" ? "Vehicle not found" : error.message },
                    { status: error.code === "PGRST116" ? 404 : 500 }
                );
            }
            const deny = assertOwnershipOrDeny(v, auth.profile);
            if (deny) return deny;
            vehicle = v || null;
        }

        if (!vehicle) {
            return NextResponse.json(
                { error: "No vehicle found for the compliance pack" },
                { status: 422 }
            );
        }

        // Honest MVDA guard: refuse to emit a "no damage" pack when damage is
        // flagged but the required disclosure notes are missing.
        if (vehicle.known_damage) {
            try {
                assertDamageDisclosureForPublish({
                    known_damage: vehicle.known_damage,
                    status: "Active",
                    disclosure: vehicle.disclosure,
                });
            } catch (err) {
                return NextResponse.json(
                    {
                        error:
                            err instanceof Error
                                ? err.message
                                : "Known damage is flagged — add disclosure notes first.",
                    },
                    { status: 422 }
                );
            }
        }

        const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" ");
        const date = new Date().toISOString().split("T")[0] ?? undefined;

        const docs = [
            {
                type: "we_owe" as const,
                bytes: await buildWeOwePdfBytes({
                    dealer,
                    customerName: customer?.name || null,
                    vehicleLabel,
                    vin: vehicle.vin,
                    items: weOweItems,
                    date,
                }),
            },
            {
                type: "buyers_guide" as const,
                bytes: await buildBuyersGuidePdfBytes({
                    dealer,
                    vehicleLabel,
                    vin: vehicle.vin,
                    year: vehicle.year,
                    make: vehicle.make,
                    model: vehicle.model,
                    odometer: vehicle.odometer ?? undefined,
                    date,
                }),
            },
            {
                type: "known_damage" as const,
                bytes: await buildKnownDamageDisclosurePdfBytes({
                    dealer,
                    vehicleLabel,
                    vin: vehicle.vin,
                    disclosure:
                        vehicle.disclosure?.trim() ||
                        (vehicle.known_damage
                            ? "Known damage was disclosed at time of sale."
                            : "No known damage disclosed."),
                    date,
                }),
            },
        ];

        const packBytes = await buildCompliancePackPdfBytes(docs);

        await logAudit(supabase, {
            action: "compliance.pack_generated",
            entity_type: "document",
            entity_id: vehicle.id,
            actor_id: auth.profile.id,
            actor_email: auth.profile.email,
            actor_role: auth.profile.role,
            dealership_id: auth.profile.dealership_id,
            metadata: { deal_id: dealId || undefined, vehicle_id: vehicle.id },
        });

        const safeVehicle = vehicleLabel.replace(/[^\w.-]+/g, "_");
        return new NextResponse(new Uint8Array(packBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="compliance-pack-${safeVehicle}.pdf"`,
                "Cache-Control": "no-store",
                "X-Compliance-Docs": String(docs.length),
            },
        });
    } catch (error: unknown) {
        console.error("Compliance pack error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
