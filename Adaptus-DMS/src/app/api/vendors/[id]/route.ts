// app/api/vendors/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const VENDOR_ALLOWED_FIELDS = [
    "vendor_name", "contact_name", "contact_email", "contact_phone", "address",
    "gst_number", "hst_number", "pst_number", "notes",
    // Schema-actual columns used by the vendors table
    "vendor_type", "phone", "city", "province", "postal_code",
] as const;

// GET single vendor
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

        const supabase = supabaseAdmin;

        const { id } = await params;

        // Narrow fetch first to assert ownership
        const { data: existing, error: existingError } = await supabase
            .from("vendors")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Vendor not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Re-fetch the full row
        const { data, error: dbError } = await supabase
            .from("vendors")
            .select("*")
            .eq("id", id)
            .single();

        if (dbError) throw dbError;

        if (!data) {
            return NextResponse.json(
                { error: "Vendor not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error fetching vendor:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update vendor
export async function PATCH(
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

        const supabase = supabaseAdmin;

        const { id } = await params;
        const payload = await req.json();

        if (
            Object.prototype.hasOwnProperty.call(payload, "vendor_name") &&
            !String(payload.vendor_name || "").trim()
        ) {
            return NextResponse.json(
                { error: "Vendor name is required" },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("vendors")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Vendor not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, VENDOR_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        // Only force vendor_type default when the client omitted it entirely
        const updateData: Record<string, unknown> = { ...safePayload };
        if (
            Object.prototype.hasOwnProperty.call(payload, "vendor_type") &&
            !payload.vendor_type
        ) {
            updateData.vendor_type = "General";
        }

        const { data, error: dbError } = await supabase
            .from("vendors")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (dbError) throw dbError;

        if (!data) {
            return NextResponse.json(
                { error: "Vendor not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating vendor:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE vendor
export async function DELETE(
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

        const supabase = supabaseAdmin;

        const { id } = await params;

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("vendors")
            .select("id, dealership_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Vendor not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        const { error: dbError } = await supabase
            .from("vendors")
            .delete()
            .eq("id", id);

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting vendor:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
