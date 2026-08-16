import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;

        const url = new URL(req.url);
        const vin = url.searchParams.get("vin");

        if (!vin) {
            return Response.json({ error: "VIN is required" }, { status: 400 });
        }

        // Skip cache check - always fetch fresh data from NHTSA
        // To re-enable cache, uncomment the section below

        // Call NHTSA vPIC API for real data
        const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin.toUpperCase()}?format=json`;

        const nhtsaResponse = await fetch(nhtsaUrl);
        const nhtsaData = await nhtsaResponse.json();

        if (!nhtsaData.Results || nhtsaData.Results.length === 0) {
            return Response.json({ error: "Failed to decode VIN" }, { status: 400 });
        }

        const v = nhtsaData.Results[0];

        // Map NHTSA data to our format
        const vehicleData = {
            vin: vin.toUpperCase(),
            year: v.ModelYear ? parseInt(v.ModelYear) : null,
            make: v.Make || null,
            model: v.Model || null,
            trim: v.Trim || null,
            engine: v.EngineCylinders ? `${v.EngineCylinders}Cylinder ${v.EngineDisplacement || ''}`.trim() : null,
            body_style: v.BodyClass || null,
            fuel_type: v.FuelTypePrimary || null,
            transmission: v.TransmissionStyle || null,
            drivetrain: v.DriveType || null,
            exterior_color: v.Manufacturer || null,
            interior_color: v.SeatBeltsAll || null,
            source: 'NHTSA',
        };

        // Cache the result
        await supabase
            .from("vin_lookup_history")
            .insert(vehicleData);

        return Response.json({ data: vehicleData });
    } catch (error) {
        console.error("Error looking up VIN:", error);
        return Response.json({ error: "Failed to lookup VIN" }, { status: 500 });
    }
}
