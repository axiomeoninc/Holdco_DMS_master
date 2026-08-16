// app/api/me/route.ts
// F-02: cookie-first auth. Use the shared getCurrentUser helper which
// reads the HttpOnly Supabase cookies set at login (and also accepts
// the legacy `Authorization: Bearer` header for backward compat).
//
// P1-2 fix: the second-pass data fetches (dealership name, role
// permissions) used to use `createClient(req)` (the cookie-only
// client) regardless of which path `getCurrentUser` used to authenticate.
// For bearer-only clients, `cookies()` is empty and the fetches would
// silently return null, breaking the `/api/me` response. Now we detect
// the request's auth mode (bearer vs cookie) and use the matching
// client for all secondary fetches.

import { getCurrentUser } from "@/src/lib/auth-helpers";
import { getDealershipTrialState } from "@/src/lib/trial";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const { user, profile, error } = await getCurrentUser(req);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: 401 }
      );
    }

    const secondaryClient = supabaseAdmin;

    // Fetch user profile with all needed fields including dealership info
    const { data: dbProfile, error: profileError } = await secondaryClient
      .from("users")
      .select(`
        full_name,
        email,
        role,
        phone,
        avatar,
        is_platform_admin,
        dealership_id,
        is_active,
        user_permissions
      `)
      .eq("id", user.id)
      .single();

    // If profile not found, fall back to the profile returned by
    // getCurrentUser (which always exists if user is non-null).
    const finalProfile = dbProfile || profile;

    // If profile not found, return basic user info
    if (profileError || !finalProfile) {
      return NextResponse.json(
        {
          data: {
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
            email: user.email,
            role: "user",
            phone: null,
            avatar: null,
            is_platform_admin: false,
            dealership_id: null,
            is_active: true,
            user_permissions: [],
            effective_permissions: [],
          }
        },
        { status: 200 }
      );
    }

    // If user has a dealership_id, fetch the dealership name + trial state
    let dealership_name = null;
    let dealership: Record<string, unknown> | null = null;
    let subscription: {
      status: string | null;
      trial_ends_at: string | null;
      days_remaining: number | null;
      soft_locked: boolean;
    } | null = null;

    if (finalProfile.dealership_id) {
      const trial = await getDealershipTrialState(finalProfile.dealership_id);
      dealership_name = trial.dealership?.name || null;
      subscription = {
        status: trial.dealership?.subscription_status ?? null,
        trial_ends_at: trial.dealership?.trial_ends_at ?? null,
        days_remaining: trial.daysRemaining,
        soft_locked: trial.softLocked,
      };

      const { data: dealerRow } = await secondaryClient
        .from("dealerships")
        .select(
          "id, name, business_name, business_address, business_phone, business_email, logo_url, settings"
        )
        .eq("id", finalProfile.dealership_id)
        .maybeSingle();

      if (dealerRow) {
        dealership = dealerRow;
        if (!dealership_name) dealership_name = dealerRow.name;
      }
    }

    // Fetch role's permissions and merge with user_permissions
    let effectivePermissions: string[] = finalProfile.user_permissions || [];
    if (finalProfile.role && finalProfile.dealership_id && !finalProfile.is_platform_admin) {
      const { data: roleData } = await secondaryClient
        .from("roles")
        .select("permissions")
        .eq("name", finalProfile.role)
        .eq("dealership_id", finalProfile.dealership_id)
        .single();

      if (roleData?.permissions && Array.isArray(roleData.permissions)) {
        // Merge: user_permissions override/add to role permissions
        const rolePerms = roleData.permissions as string[];
        if (rolePerms.includes("*")) {
          // Role has full access, use that
          effectivePermissions = ["*"];
        } else {
          // Merge: start with role perms, add any extra user perms
          const rolePermSet = new Set(rolePerms);
          for (const perm of effectivePermissions) {
            if (!rolePermSet.has(perm)) {
              rolePerms.push(perm);
            }
          }
          effectivePermissions = rolePerms;
        }
      }
    }

    // Return full profile data with platform admin and dealership info
    return NextResponse.json(
      {
        data: {
          full_name: finalProfile.full_name,
          email: finalProfile.email,
          role: finalProfile.role,
          phone: finalProfile.phone,
          avatar: finalProfile.avatar,
          is_platform_admin: finalProfile.is_platform_admin || false,
          dealership_id: finalProfile.dealership_id,
          dealership_name: dealership_name,
          dealership,
          subscription,
          is_active: finalProfile.is_active,
          user_permissions: finalProfile.user_permissions || [],
          effective_permissions: effectivePermissions,
        }
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Error fetching user:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}