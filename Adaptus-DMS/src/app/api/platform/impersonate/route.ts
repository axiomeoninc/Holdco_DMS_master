// POST /api/platform/impersonate — real session swap (platform admin only)
// GET  /api/platform/impersonate — viewing-as status (stash cookie present)

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createTokenClient } from "@/src/lib/server-token";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
  applyAuthCookieOptions,
  decodeStash,
  encodeStash,
  IMPERSONATE_STASH_COOKIE,
  IMPERSONATE_STASH_MAX_AGE,
  isSecureRequest,
  stashCookieOptions,
  type ImpersonateStash,
} from "@/src/lib/impersonation";
import { NextRequest, NextResponse } from "next/server";

type PendingCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Viewing-as status for the dashboard banner (no secrets). */
export async function GET(req: NextRequest) {
  try {
    const stash = decodeStash(req.cookies.get(IMPERSONATE_STASH_COOKIE)?.value);
    if (!stash) {
      return NextResponse.json({ active: false });
    }
    return NextResponse.json({
      active: true,
      target: {
        id: stash.targetUserId,
        email: stash.targetEmail,
        full_name: stash.targetFullName,
        role: stash.targetRole,
      },
      admin: {
        id: stash.adminUserId,
        email: stash.adminEmail,
      },
    });
  } catch (error: unknown) {
    console.error("Error reading impersonation status:", error);
    return NextResponse.json({ active: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    let supabase;
    try {
      supabase = createTokenClient(req);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "MISSING_BEARER_TOKEN"
      ) {
        return fail("Authorization token required", 401);
      }
      throw error;
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return fail("Invalid or expired token", 401);
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("is_platform_admin, email, full_name")
      .eq("id", user.id)
      .single();

    if (!currentUser?.is_platform_admin) {
      return fail("Unauthorized - Platform admin access required", 403);
    }

    if (req.cookies.get(IMPERSONATE_STASH_COOKIE)?.value) {
      return fail("Already impersonating. Exit the current session first.", 409);
    }

    const payload = await req.json();
    const targetUserId =
      typeof payload?.targetUserId === "string" ? payload.targetUserId : "";

    if (!targetUserId) {
      return fail("targetUserId is required", 400);
    }

    const { data: targetUser, error: targetError } = await supabase
      .from("users")
      .select(
        "id, email, full_name, role, dealership_id, is_active, is_platform_admin, user_permissions"
      )
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetUser) {
      return fail("User not found", 404);
    }

    if (!targetUser.is_active) {
      return fail("Cannot impersonate inactive user", 400);
    }

    if (targetUser.is_platform_admin) {
      return fail("Cannot impersonate platform admin", 400);
    }

    const secure = isSecureRequest(req);
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const adminClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only for getSession
        },
      },
    });

    const {
      data: { session: adminSession },
      error: sessionReadError,
    } = await adminClient.auth.getSession();

    if (
      sessionReadError ||
      !adminSession?.refresh_token ||
      !adminSession.access_token
    ) {
      return fail("Cannot stash admin session for recovery", 500);
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.email,
      });

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      console.error("Impersonate generateLink failed:", linkError);
      return fail(
        linkError?.message || "Failed to create impersonation session",
        500
      );
    }

    const pendingCookies: PendingCookie[] = [];
    const swapClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({
              name,
              value,
              options: options as Record<string, unknown>,
            });
            try {
              cookieStore.set(
                name,
                value,
                applyAuthCookieOptions(options as Record<string, unknown>, {
                  secure,
                }) as Parameters<typeof cookieStore.set>[2]
              );
            } catch {
              // Response cookies still apply below.
            }
          });
        },
      },
    });

    const { data: otpData, error: otpError } = await swapClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashedToken,
    });

    if (otpError || !otpData?.session) {
      console.error("Impersonate verifyOtp failed:", otpError);
      return fail(
        otpError?.message || "Failed to establish target session",
        500
      );
    }

    const stash: ImpersonateStash = {
      adminUserId: user.id,
      adminEmail: currentUser.email || user.email || "",
      accessToken: adminSession.access_token,
      refreshToken: adminSession.refresh_token,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      targetFullName: targetUser.full_name,
      targetRole: targetUser.role,
      stashedAt: Date.now(),
    };

    try {
      await supabase.rpc("log_audit_action", {
        p_action: "platform.impersonate",
        p_entity_type: "user",
        p_entity_id: targetUser.id,
        p_actor_id: user.id,
        p_target_id: targetUser.id,
        p_metadata: JSON.stringify({
          target_email: targetUser.email,
          actor_email: currentUser.email,
        }),
      });
    } catch (auditErr) {
      console.error(
        "Impersonate audit log failed (session still swapped):",
        auditErr
      );
    }

    const response = NextResponse.json({
      success: true,
      impersonation_mode: true,
      target_user: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.full_name,
        role: targetUser.role,
        dealership_id: targetUser.dealership_id,
      },
      expires_in: IMPERSONATE_STASH_MAX_AGE,
    });

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(
        name,
        value,
        applyAuthCookieOptions(options, { secure }) as Parameters<
          typeof response.cookies.set
        >[2]
      );
    }

    response.cookies.set(
      IMPERSONATE_STASH_COOKIE,
      encodeStash(stash),
      stashCookieOptions(secure) as Parameters<typeof response.cookies.set>[2]
    );

    return response;
  } catch (error: unknown) {
    console.error("Error impersonating user:", error);
    return fail(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
