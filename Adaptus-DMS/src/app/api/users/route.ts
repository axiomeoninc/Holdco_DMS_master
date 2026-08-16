// app/api/users/route.ts
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { inviteEmail } from "@/src/lib/email";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { nonEmptyDealershipId } from "@/src/lib/platform-rooftop";
import {
    isResendConfigured,
    sendEmail,
} from "@/src/lib/resend";
import { resolveEmailFrom } from "@/src/lib/email/from";
import {
    generateResetToken,
    sha256Hex,
} from "@/src/lib/trial";
import { NextRequest, NextResponse } from "next/server";

function appBaseUrl(req: NextRequest): string {
    const fromEnv = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
    return "https://app.flashfender.com";
}

// GET all users (filtered by dealership OR all for platform admin)
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        const isDealershipAdmin = currentUser.role === "Admin";

        if (!isPlatformAdmin && !isDealershipAdmin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const q = url.searchParams.get("q");
        const role = url.searchParams.get("role");
        const startDateFrom = url.searchParams.get("start_date_from");
        const startDateTo = url.searchParams.get("start_date_to");

        const scope = tenantScopeFromRequest(tenant, req);
        let query = applyTenantScope(
            supabase
                .from("users")
                .select(`
                id, avatar, full_name, role, email, phone,
                start_date, is_active, dealership_id, created_at, updated_at,
                is_platform_admin, user_permissions
            `, { count: "exact" })
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1),
            scope,
            "users"
        );

        if (role) query = query.eq("role", role);
        if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
        if (startDateFrom) query = query.gte("start_date", startDateFrom);
        if (startDateTo) query = query.lte("start_date", startDateTo);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        // If platform admin, fetch dealership names for display
        let usersWithDealerships = data || [];
        if (isPlatformAdmin && usersWithDealerships.length > 0) {
            const dealershipIds = [...new Set(usersWithDealerships
                .filter((u) => u.dealership_id)
                .map((u) => u.dealership_id))];

            if (dealershipIds.length > 0) {
                const { data: dealerships } = await supabase
                    .from("dealerships")
                    .select("id, name")
                    .in("id", dealershipIds);

                const dealershipMap: Record<string, string> = {};
                dealerships?.forEach((d) => {
                    dealershipMap[d.id] = d.name;
                });

                usersWithDealerships = usersWithDealerships.map((u) => ({
                    ...u,
                    dealership_name: u.dealership_id ? (dealershipMap[u.dealership_id] || "Unknown") : null
                }));
            }
        }

        return NextResponse.json({
            data: usersWithDealerships,
            count: count || 0,
            limit,
            offset,
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching users:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create user
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;

        const isDealershipAdmin = currentUser.role === "Admin";

        if (!isPlatformAdmin && !isDealershipAdmin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }

        const payload = await req.json();
        const { full_name, role, email, phone, start_date, password, avatar, target_dealership_id } = payload;
        const writeScope = tenantScopeFromRequest(tenant, req);

        // Dealership Admin cannot grant platform admin via API
        if (payload.is_platform_admin === true && !isPlatformAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Cannot set is_platform_admin" },
                { status: 403 }
            );
        }

        // Reject client-supplied dealership_id spoofing for non-platform admins
        if (
            !isPlatformAdmin &&
            (payload.dealership_id || target_dealership_id) &&
            (payload.dealership_id || target_dealership_id) !== currentUser?.dealership_id
        ) {
            return NextResponse.json(
                { error: "Forbidden - Cannot assign user to another dealership" },
                { status: 403 }
            );
        }

        // Validate required fields
        const required = ["full_name", "role", "email", "start_date"];
        for (const field of required) {
            if (!payload[field]) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        const validRoles = ["Admin", "Staff", "Manager", "Salesperson"];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: "Invalid role. Must be Admin, Staff, Manager, or Salesperson" },
                { status: 400 }
            );
        }

        // Determine which dealership to assign user to (auth-derived for tenant admins)
        const assignedDealershipId = requireWriteDealershipId({
            ...writeScope,
            platformDealershipId:
                writeScope.platformDealershipId ||
                (isPlatformAdmin
                    ? nonEmptyDealershipId(target_dealership_id)
                    : undefined),
        });

        // Create auth user
        // SECURITY: F-05 of v3 master plan. Reject creation without a password;
        // never default to a known credential. The admin must set one explicitly.
        // After create we also email a one-time setup link so the user can set
        // their own password (same token pattern as forgot-password).
        if (!password || typeof password !== "string" || password.length < 12) {
            return NextResponse.json(
                { error: "Password is required and must be at least 12 characters" },
                { status: 400 }
            );
        }
        // Reject the well-known defaults explicitly (defense in depth).
        if (password === "Password@123" || password === "password" || password === "12345678") {
            return NextResponse.json(
                { error: "Password is too common; please choose a stronger one" },
                { status: 400 }
            );
        }
        const { data: authData, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name,
                role
            },
        });

        if (authError2) {
            return NextResponse.json(
                { error: authError2.message },
                { status: 400 }
            );
        }

        // Create user profile
        const { data: profile, error: profileError } = await supabase
            .from("users")
            .insert({
                id: authData.user.id,
                full_name,
                role,
                email,
                phone: phone || null,
                start_date,
                avatar: avatar || null,
                dealership_id: assignedDealershipId,
                is_platform_admin: false,
                is_active: true,
                user_permissions: payload.user_permissions || [],
            })
            .select()
            .single();

        if (profileError) {
            // Rollback - delete auth user if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw profileError;
        }

        // Also insert into user_roles junction table
        if (profile) {
            // Find the role_id for the role being assigned
            const { data: roleData } = await scopedTable(supabase, "roles", {
                dealershipId: assignedDealershipId,
                isPlatformAdmin: false,
            })
                .select("id")
                .eq("name", role)
                .maybeSingle();

            if (roleData) {
                await supabase
                    .from("user_roles")
                    .insert({
                        user_id: profile.id,
                        role_id: roleData.id,
                    });
            }
        }

        // Staff invite / welcome email (best-effort — never roll back create)
        let inviteEmailSent = false;
        let inviteEmailWarning: string | undefined;
        let dealershipName: string | null = null;
        let emailFrom: string | undefined;
        if (assignedDealershipId) {
            const { data: dealer } = await supabaseAdmin
                .from("dealerships")
                .select("name, business_name, settings")
                .eq("id", assignedDealershipId)
                .maybeSingle();
            if (dealer) {
                dealershipName =
                    (dealer.business_name as string) ||
                    (dealer.name as string) ||
                    null;
                emailFrom = resolveEmailFrom(
                    (dealer.settings as Record<string, unknown>) || null
                ).from;
            }
        }

        let setupUrl: string | null = null;
        try {
            const token = generateResetToken();
            const tokenHash = await sha256Hex(token);
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            await supabaseAdmin
                .from("password_reset_tokens")
                .update({ consumed_at: new Date().toISOString() })
                .eq("user_id", authData.user.id)
                .is("consumed_at", null);
            await supabaseAdmin.from("password_reset_tokens").insert({
                user_id: authData.user.id,
                token_hash: tokenHash,
                expires_at: expiresAt,
            });
            const emailNorm = String(email).trim().toLowerCase();
            setupUrl = `${appBaseUrl(req)}/reset-password?token=${token}&email=${encodeURIComponent(emailNorm)}`;
        } catch (err) {
            console.error("staff invite: failed to create setup token", err);
        }

        if (!isResendConfigured()) {
            inviteEmailWarning =
                "Invite email not sent — Resend is not configured (RESEND_API_KEY / EMAIL_FROM).";
        } else {
            const mail = inviteEmail({
                recipientName: full_name,
                recipientEmail: String(email).trim(),
                role,
                dealershipName,
                setupUrl,
                loginUrl: `${appBaseUrl(req)}/login`,
                passwordWasSetByAdmin: true,
            });
            const sent = await sendEmail({
                to: String(email).trim(),
                from: emailFrom,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
            });
            if (sent.ok) {
                inviteEmailSent = true;
            } else {
                inviteEmailWarning = sent.error;
                console.error("staff invite email failed:", sent.error, {
                    missingConfig: sent.missingConfig,
                });
            }
        }

        return NextResponse.json(
            {
                data: profile,
                default_password_used: false,
                invite_email_sent: inviteEmailSent,
                ...(inviteEmailWarning
                    ? { invite_email_warning: inviteEmailWarning }
                    : {}),
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error creating user:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
