// app/api/test-drives/[id]/route.ts
//
// P1-1 fix: all four handlers use `pickSupabaseClient` so platform admins
// get the service-role client (RLS bypass for cross-dealership ops) while
// regular users keep the request-scoped RLS client.
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, pickSupabaseClient, requireDealershipAccess } from "@/src/lib/auth-helpers";

const TEST_DRIVE_ALLOWED_FIELDS = [
    "scheduled_at", "status", "outcome", "notes", "customer_id", "vehicle_id",
    "end_time", "signature_image_url",
    // Schema-actual columns used by the test_drives table
    "scheduled_date", "start_time", "lead_id", "user_id",
] as const;

type TestDriveSupabaseClient = ReturnType<typeof pickSupabaseClient>["supabase"];

// Helper function to enrich a test drive with related data
async function enrichTestDrive<T extends { customer_id?: string | null; lead_id?: string | null; vehicle_id?: string | null; user_id?: string | null }>(
    supabase: TestDriveSupabaseClient,
    testDrive: T
) {
    const [customerData, leadData, vehicleData, userData] = await Promise.all([
        testDrive.customer_id
            ? supabase.from("customers").select("id, name, email, phone").eq("id", testDrive.customer_id).single()
            : { data: null },
        testDrive.lead_id
            ? supabase.from("leads").select("id, source, status").eq("id", testDrive.lead_id).single()
            : { data: null },
        testDrive.vehicle_id
            ? supabase.from("vehicles").select("id, make, model, year, vin, stock_number").eq("id", testDrive.vehicle_id).single()
            : { data: null },
        testDrive.user_id
            ? supabase.from("users").select("id, full_name, email").eq("id", testDrive.user_id).single()
            : { data: null },
    ]);

    return {
        ...testDrive,
        customer: customerData.data,
        lead: leadData.data,
        vehicle: vehicleData.data,
        salesperson: userData.data,
    };
}

// GET single test drive
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
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
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

        // Narrow fetch first to assert ownership (assignee lives on user_id, not assigned_to)
        const { data: existing, error: existingError } = await supabase
            .from("test_drives")
            .select("id, dealership_id, user_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(
            { dealership_id: existing.dealership_id, assigned_to: existing.user_id },
            auth.profile
        );
        if (deny) return deny;

        // Re-fetch the full row
        const { data: testDrive, error: dbError } = await supabase
            .from("test_drives")
            .select("*")
            .eq("id", id)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        const enriched = await enrichTestDrive(supabase, testDrive);

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        console.error("Error fetching test drive:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT update test drive (full update)
export async function PUT(
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
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
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
        const payload = await req.json();

        // Validate required fields for full update - use actual schema columns
        const required = ["vehicle_id", "scheduled_date"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Validate that either customer_id or lead_id is provided (not both)
        const hasCustomer = !!payload.customer_id;
        const hasLead = !!payload.lead_id;

        if (!hasCustomer && !hasLead) {
            return NextResponse.json(
                { error: "Either customer_id or lead_id is required" },
                { status: 400 }
            );
        }

        if (hasCustomer && hasLead) {
            return NextResponse.json(
                { error: "Cannot provide both customer_id and lead_id. Please provide only one." },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("test_drives")
            .select("id, dealership_id, user_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(
            { dealership_id: existing.dealership_id, assigned_to: existing.user_id },
            auth.profile
        );
        if (deny) return deny;

        // Build update data - use actual schema column names
        const updateData = {
            vehicle_id: payload.vehicle_id,
            customer_id: payload.customer_id || null,
            lead_id: payload.lead_id || null,
            user_id: payload.user_id || null,
            scheduled_date: payload.scheduled_date,
            start_time: payload.start_time || payload.scheduled_date,
            end_time: payload.end_time || payload.scheduled_date,
            status: payload.status || "Scheduled",
            notes: payload.notes || null,
            outcome: payload.outcome || null,
        };

        const { data: updatedTestDrive, error: dbError } = await supabase
            .from("test_drives")
            .update(updateData)
            .eq("id", id)
            .select("*")
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        const enriched = await enrichTestDrive(supabase, updatedTestDrive);

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        console.error("Error updating test drive:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update test drive (partial update)
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

        let supabase;
        try {
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
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
        const payload = await req.json();

        // If both customer_id and lead_id are being updated, validate
        if (payload.customer_id && payload.lead_id) {
            return NextResponse.json(
                { error: "Cannot provide both customer_id and lead_id. Please provide only one." },
                { status: 400 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("test_drives")
            .select("id, dealership_id, user_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(
            { dealership_id: existing.dealership_id, assigned_to: existing.user_id },
            auth.profile
        );
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, TEST_DRIVE_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        if (Object.keys(safePayload).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        const { data: updatedTestDrive, error: dbError } = await supabase
            .from("test_drives")
            .update(safePayload)
            .eq("id", id)
            .select("*")
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        const enriched = await enrichTestDrive(supabase, updatedTestDrive);

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        console.error("Error updating test drive:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE test drive
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

        let supabase;
        try {
            const picked = pickSupabaseClient(req, auth.profile);
            supabase = picked.supabase;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
                return NextResponse.json(
                    { error: "Authorization token required" },
                    { status: 401 }
                );
            }
            throw error;
        }

        const userRole = auth.profile.role;
        const userPerms = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;

        // Check test_drives:delete permission
        const canDelete = isPlatformAdmin ||
            userRole === "Admin" ||
            userRole === "Manager" ||
            userPerms.includes("test_drives:delete") ||
            userPerms.includes("*");

        if (!canDelete) {
            return NextResponse.json(
                { error: "Forbidden - You need test_drives:delete permission to delete test drives" },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("test_drives")
            .select("id, dealership_id, user_id")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(
            { dealership_id: existing.dealership_id, assigned_to: existing.user_id },
            auth.profile
        );
        if (deny) return deny;

        const { error: dbError } = await supabase
            .from("test_drives")
            .delete()
            .eq("id", id);

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Test drive not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            message: "Test drive deleted successfully"
        });
    } catch (error: unknown) {
        console.error("Error deleting test drive:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
