import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const vinRaw = formData.get("vin");
        const vin =
            typeof vinRaw === "string" ? vinRaw.trim().toUpperCase() : "";

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.type !== "application/pdf") {
            return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
        }

        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
        }

        // Generate unique file name (scoped path under dealership when available)
        const fileExt = "pdf";
        const dealerPrefix = auth.profile.dealership_id
            ? `${auth.profile.dealership_id}/`
            : "";
        const fileName = `${dealerPrefix}carfax-${vin || "unknown"}-${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabaseAdmin.storage
            .from("carfax-reports")
            .upload(fileName, buffer, {
                contentType: "application/pdf",
                upsert: true,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError.message);
            const msg = uploadError.message || "Upload failed";
            const bucketMissing = /bucket|not found|does not exist/i.test(msg);
            return NextResponse.json(
                {
                    error: bucketMissing
                        ? "CARFAX storage is not configured (missing 'carfax-reports' bucket). Contact an administrator."
                        : `Failed to upload CARFAX report: ${msg}`,
                },
                { status: bucketMissing ? 503 : 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from("carfax-reports")
            .getPublicUrl(fileName);

        const url = urlData.publicUrl;

        return NextResponse.json({ url, fileName });
    } catch (error) {
        console.error("Error uploading CARFAX report:", error);
        return NextResponse.json({ error: "Failed to upload CARFAX report" }, { status: 500 });
    }
}
