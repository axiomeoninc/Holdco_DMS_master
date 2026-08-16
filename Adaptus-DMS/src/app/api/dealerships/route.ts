// app/api/dealerships/route.ts
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/src/lib/auth-helpers";

// GET all dealerships (platform admin only)
export async function GET(req: NextRequest) {
    try {
        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile || !auth.user) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;
        const user = auth.user;
        const currentUser = auth.profile;

        const url = new URL(req.url);
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
        const status = url.searchParams.get("status");
        const q = url.searchParams.get("q")?.trim() || null;

        let query = supabase
            .from("dealerships")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq("status", status);
        }
        if (q) {
            // Strip PostgREST filter metacharacters before embedding in .or()
            const safe = q.replace(/[%_,.()\\]/g, "");
            if (safe) {
                query = query.or(
                    `name.ilike.%${safe}%,slug.ilike.%${safe}%,business_email.ilike.%${safe}%,business_name.ilike.%${safe}%`
                );
            }
        }

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        // Fetch user counts + subscriptions for page rows only
        const dealershipIds = (data || []).map((d: { id: string }) => d.id);
        const userCounts: Record<string, number> = {};
        const subscriptionsByDealership: Record<
            string,
            {
                plan_name: string;
                plan_price: number;
                billing_cycle: string;
                status: string;
            }
        > = {};

        if (dealershipIds.length > 0) {
            const { data: users } = await supabase
                .from("users")
                .select("dealership_id")
                .in("dealership_id", dealershipIds);

            users?.forEach((u: { dealership_id: string | null }) => {
                if (u.dealership_id) {
                    userCounts[u.dealership_id] = (userCounts[u.dealership_id] || 0) + 1;
                }
            });

            const { data: subs } = await supabase
                .from("subscriptions")
                .select("dealership_id, plan_name, plan_price, billing_cycle, status")
                .in("dealership_id", dealershipIds);

            subs?.forEach(
                (s: {
                    dealership_id: string;
                    plan_name: string;
                    plan_price: number;
                    billing_cycle: string;
                    status: string;
                }) => {
                    subscriptionsByDealership[s.dealership_id] = {
                        plan_name: s.plan_name,
                        plan_price: s.plan_price,
                        billing_cycle: s.billing_cycle,
                        status: s.status,
                    };
                }
            );
        }

        const dataWithCounts = (data || []).map((d: { id: string }) => ({
            ...d,
            user_count: userCounts[d.id] || 0,
            subscription: subscriptionsByDealership[d.id] || undefined,
        }));

        return NextResponse.json({
            data: dataWithCounts,
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        console.error("Error fetching dealerships:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create new dealership (platform admin only)
export async function POST(req: NextRequest) {
    try {
        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile || !auth.user) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;
        const user = auth.user;
        const currentUser = auth.profile;

        const payload = await req.json();
        const {
            name,
            slug,
            subdomain,
            business_name,
            business_address,
            business_phone,
            business_email,
            plan_name,
            admin_email,
            admin_password,
            admin_full_name
        } = payload;

        // Validate required fields
        if (!name) {
            return NextResponse.json(
                { error: "Missing required field: name" },
                { status: 400 }
            );
        }

        // Create slug from name if not provided
        const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Create the dealership
        const { data: dealership, error: dealershipError } = await supabase
            .from("dealerships")
            .insert({
                name,
                slug: generatedSlug,
                subdomain: subdomain || generatedSlug,
                business_name: business_name || name,
                business_address: business_address || null,
                business_phone: business_phone || null,
                business_email: business_email || null,
                status: 'Trial',
            })
            .select()
            .single();

        if (dealershipError) {
            if (dealershipError.code === '23505') {
                return NextResponse.json(
                    { error: "A dealership with this slug or subdomain already exists" },
                    { status: 400 }
                );
            }
            throw dealershipError;
        }

        // Create default subscription for the dealership
        const { error: subscriptionError } = await supabase
            .from("subscriptions")
            .insert({
                dealership_id: dealership.id,
                plan_name: plan_name || 'Basic',
                plan_price: plan_name === 'Premium' ? 299 : (plan_name === 'Standard' ? 149 : 0),
                billing_cycle: 'monthly',
                status: 'Trial',
                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
            });

        if (subscriptionError) {
            console.error("Error creating subscription:", subscriptionError);
        }

        // If admin_email is provided, create the first admin user for this dealership
        if (admin_email && admin_full_name) {
            try {
                // SECURITY: F-05. Require a real password when creating the first admin.
                if (!admin_password || admin_password.length < 12) {
                    return NextResponse.json(
                        { error: "admin_password is required and must be at least 12 characters" },
                        { status: 400 }
                    );
                }
                if (admin_password === "Password@123" || admin_password === "password") {
                    return NextResponse.json(
                        { error: "admin_password is too common; please choose a stronger one" },
                        { status: 400 }
                    );
                }
                // Create auth user
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: admin_email,
                    password: admin_password,
                    email_confirm: true,
                    user_metadata: {
                        full_name: admin_full_name,
                        role: 'Admin'
                    },
                });

                if (!authError && authData.user) {
                    // Create user profile linked to this dealership
                    await supabase
                        .from("users")
                        .insert({
                            id: authData.user.id,
                            email: admin_email,
                            full_name: admin_full_name,
                            role: 'Admin',
                            dealership_id: dealership.id,
                            is_active: true,
                        });

                    // Create default roles for the dealership
                    const defaultRoles = [
                        { name: 'Admin', description: 'Full access to dealership', is_system: true, permissions: ['*'] },
                        { name: 'Manager', description: 'Manage inventory, sales, and staff', is_system: true, permissions: ['deals:*', 'vehicles:*', 'customers:*', 'leads:*'] },
                        { name: 'Salesperson', description: 'Manage assigned leads and deals', is_system: true, permissions: ['leads:read', 'leads:write', 'deals:read', 'deals:write'] },
                        { name: 'Staff', description: 'Limited access', is_system: true, permissions: ['deals:read', 'vehicles:read', 'customers:read'] },
                    ];

                    for (const role of defaultRoles) {
                        await supabase
                            .from("roles")
                            .insert({
                                dealership_id: dealership.id,
                                ...role
                            });
                    }
                }
            } catch (err) {
                console.error("Error creating admin user:", err);
            }
        }

        return NextResponse.json(
            { data: dealership },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Error creating dealership:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
