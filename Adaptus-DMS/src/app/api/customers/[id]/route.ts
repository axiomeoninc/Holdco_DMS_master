// app/api/customers/[id]/route.ts
//
// P1-1 + P1-3 fix:
//   - `pickSupabaseClient` so platform admins get service-role (cross-
//     dealership reads/writes), everyone else gets RLS-scoped client.
//   - Perm checks move AFTER the 404/ownership check (P1-3): we don't
//     leak existence to a Salesperson who guessed an id.
//   - F-08 fix: PUT now uses the same field whitelist as PATCH (was
//     previously accepting any field).
import { NextRequest, NextResponse } from "next/server";
import {
    assertOwnershipOrDeny,
    pickAllowed,
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { applyConsentTimestamps } from "@/src/lib/customer-consent";
import { clientIp } from "@/src/lib/trial";

// Consent timestamps / IPs are server-stamped via applyConsentTimestamps — never client-writable.
const CUSTOMER_ALLOWED_FIELDS = [
    "name", "email", "phone", "address", "city", "province", "postal_code",
    "status", "source", "notes", "company", "assigned_to",
    "marketing_consent", "sms_consent",
] as const;

// GET single customer
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

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const { id } = await params;

        // Narrow fetch first to assert ownership without leaking other columns
        const { data, error: dbError } = await supabase
            .from("customers")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        const deny = assertOwnershipOrDeny(data, auth.profile);
        if (deny) return deny;

        // Re-fetch the full row now that ownership is verified
        const { data: full } = await supabase
            .from("customers")
            .select("*")
            .eq("id", id)
            .single();

        return NextResponse.json({ data: full });
    } catch (error: unknown) {
        console.error("Error fetching customer:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT update customer (full update)
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

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const { id } = await params;
        const payload = await req.json();

        // P1-3: ownership check first.
        const { data: existing, error: existingError } = await supabase
            .from("customers")
            .select("id, dealership_id, assigned_to, marketing_consent, sms_consent, marketing_consent_at, sms_consent_at")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // F-08: PUT now applies the same whitelist as PATCH (was: blind
        // accept of the entire payload). dealership_id is dropped even
        // if sent.
        let safePayload = pickAllowed(payload, CUSTOMER_ALLOWED_FIELDS) as Record<string, unknown>;
        delete safePayload.dealership_id;
        safePayload = applyConsentTimestamps(safePayload, existing, { ip: clientIp(req) });

        if (Object.keys(safePayload).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Validate email format if provided
        if (safePayload.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(safePayload.email as string)) {
                return NextResponse.json(
                    { error: "Invalid email format" },
                    { status: 400 }
                );
            }
        }

        // "name" required for PUT semantics; verify after whitelist
        if (!safePayload.name) {
            return NextResponse.json(
                { error: "Missing required field: name" },
                { status: 400 }
            );
        }

        let { data, error: dbError } = await supabase
            .from("customers")
            .update(safePayload)
            .eq("id", id)
            .select()
            .single();

        if (dbError && /marketing_consent_ip|sms_consent_ip|column/i.test(dbError.message || "")) {
            const { marketing_consent_ip: _m, sms_consent_ip: _s, ...withoutIp } = safePayload;
            const retry = await supabase
                .from("customers")
                .update(withoutIp)
                .eq("id", id)
                .select()
                .single();
            data = retry.data;
            dbError = retry.error;
        }

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating customer:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update customer (partial update)
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

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const { id } = await params;
        const payload = await req.json();

        // P1-3: ownership check first.
        const { data: existing, error: existingError } = await supabase
            .from("customers")
            .select("id, dealership_id, assigned_to, marketing_consent, sms_consent, marketing_consent_at, sms_consent_at")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        let safePayload = pickAllowed(payload, CUSTOMER_ALLOWED_FIELDS) as Record<string, unknown>;
        delete safePayload.dealership_id;
        safePayload = applyConsentTimestamps(safePayload, existing, { ip: clientIp(req) });

        if (Object.keys(safePayload).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Validate email format if provided
        if (safePayload.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(safePayload.email as string)) {
                return NextResponse.json(
                    { error: "Invalid email format" },
                    { status: 400 }
                );
            }
        }

        let { data, error: dbError } = await supabase
            .from("customers")
            .update(safePayload)
            .eq("id", id)
            .select()
            .single();

        if (dbError && /marketing_consent_ip|sms_consent_ip|column/i.test(dbError.message || "")) {
            const { marketing_consent_ip: _m, sms_consent_ip: _s, ...withoutIp } = safePayload;
            const retry = await supabase
                .from("customers")
                .update(withoutIp)
                .eq("id", id)
                .select()
                .single();
            data = retry.data;
            dbError = retry.error;
        }

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating customer:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE customer
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

        const { supabase } = pickSupabaseClient(req, auth.profile);
        const { id } = await params;

        // P1-3: ownership check first. Permission gate comes after.
        const { data: existing, error: existingError } = await supabase
            .from("customers")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Permission gate after ownership.
        const userRole = auth.profile.role;
        const userPerms = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;

        const canDelete = isPlatformAdmin ||
            userRole === "Admin" ||
            userRole === "Manager" ||
            userPerms.includes("customers:delete") ||
            userPerms.includes("*");

        if (!canDelete) {
            return NextResponse.json(
                { error: "Forbidden - You need customers:delete permission to delete customers" },
                { status: 403 }
            );
        }

        // Block hard-delete when any CRM money/activity FKs still point here.
        // Prefer Merge duplicates to soft-delete + reassign.
        const relatedChecks: Array<{ table: string; label: string }> = [
            { table: "sales_deals", label: "sales deals" },
            { table: "invoices", label: "invoices" },
            { table: "leads", label: "leads" },
            { table: "quotations", label: "quotations" },
            { table: "test_drives", label: "test drives" },
            { table: "follow_ups", label: "follow-ups" },
            { table: "bill_of_sale", label: "bills of sale" },
        ];
        const blocking: string[] = [];
        for (const { table, label } of relatedChecks) {
            const { count, error: relErr } = await supabase
                .from(table)
                .select("*", { count: "exact", head: true })
                .eq("customer_id", id);
            if (relErr) {
                if (/relation|does not exist|Could not find/i.test(relErr.message || "")) {
                    continue;
                }
                console.error(`Error checking ${table}:`, relErr);
                continue;
            }
            if (count && count > 0) blocking.push(`${label} (${count})`);
        }
        if (blocking.length > 0) {
            return NextResponse.json(
                {
                    error: `Cannot delete customer with existing ${blocking.join(", ")}. Use Merge duplicates or reassign first.`,
                },
                { status: 400 }
            );
        }

        const { error: dbError } = await supabase
            .from("customers")
            .delete()
            .eq("id", id);

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Customer not found" },
                    { status: 404 }
                );
            }
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            message: "Customer deleted successfully"
        });
    } catch (error: unknown) {
        console.error("Error deleting customer:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
