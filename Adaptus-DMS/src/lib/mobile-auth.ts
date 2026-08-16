// Mobile auth helpers for /api/auth/mobile/*.
//
// Access token is returned in JSON so Expo can send
// `Authorization: Bearer <access_token>` (getCurrentUser fallback).
// Refresh stays in HttpOnly Supabase session cookies (same as web login).
// Do not put refresh_token on POST /api/auth/login JSON.
//
// Expo: credentials: "include" on login/refresh/logout so the cookie jar
// can refresh. POST /api/auth/mobile/refresh also accepts { refresh_token }
// if a client already holds one — login does not return it.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";
import { getDealershipTrialState } from "./trial";
import { scopedTable, tenantScopeFromProfile } from "./tenant-scope";
import type { ParseResult } from "./mobile-auth-parse";

export {
  parseBearerAuthorization,
  parseMobileLoginBody,
  parseMobileRefreshBody,
  parsePushTokenBody,
} from "./mobile-auth-parse";
export type {
  MobileLoginInput,
  MobileRefreshInput,
  ParseResult,
  PushTokenInput,
} from "./mobile-auth-parse";

export const MOBILE_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type MobileMeDealership = {
  id: string;
  name: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  logo_url: string | null;
  settings: unknown;
};

export type MobileMeSubscription = {
  status: string | null;
  trial_ends_at: string | null;
  days_remaining: number | null;
  soft_locked: boolean;
};

/** Matches GET /api/me `data` plus `id` (me currently omits id). */
export type MobileMeUser = {
  id: string;
  email: string;
  role: string;
  dealership_id: string | null;
  is_platform_admin: boolean;
  full_name: string | null;
  phone: string | null;
  avatar: string | null;
  is_active: boolean;
  user_permissions: string[];
  effective_permissions: string[];
  dealership_name: string | null;
  dealership: MobileMeDealership | null;
  subscription: MobileMeSubscription | null;
};

export type PendingAuthCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function readJsonBody(req: NextRequest): Promise<ParseResult<unknown>> {
  const text = await req.text();
  if (!text.trim()) {
    return { ok: true, value: null };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

export function isSecureRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

export function applyAuthCookieOptions(
  options: Record<string, unknown> | undefined,
  { secure, maxAge }: { secure: boolean; maxAge?: number }
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...options,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  };
  delete merged.domain;
  if (typeof maxAge === "number") {
    merged.maxAge = maxAge;
  }
  return merged;
}

export async function createMobileSessionClient(
  req: NextRequest,
  sessionMaxAge: number = MOBILE_SESSION_MAX_AGE
): Promise<{
  supabase: ReturnType<typeof createServerClient>;
  pendingCookies: PendingAuthCookie[];
  secure: boolean;
  sessionMaxAge: number;
}> {
  const pendingCookies: PendingAuthCookie[] = [];
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const secure = isSecureRequest(req);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
                maxAge: sessionMaxAge,
              }) as Parameters<typeof cookieStore.set>[2]
            );
          } catch {
            // Response cookies still apply via applyPendingCookies.
          }
        });
      },
    },
  });

  return { supabase, pendingCookies, secure, sessionMaxAge };
}

export function applyPendingCookies(
  response: NextResponse,
  pendingCookies: PendingAuthCookie[],
  { secure, maxAge, expire }: { secure: boolean; maxAge?: number; expire?: boolean }
): void {
  for (const { name, value, options } of pendingCookies) {
    const opts = expire
      ? applyAuthCookieOptions({ ...options, maxAge: 0 }, { secure })
      : applyAuthCookieOptions(options, { secure, maxAge });
    response.cookies.set(
      name,
      expire ? "" : value,
      opts as Parameters<typeof response.cookies.set>[2]
    );
  }
}

function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "Mobile";
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "Tablet";
  }
  return "Desktop";
}

export async function logMobileLoginAttempt(
  userId: string | null,
  email: string,
  success: boolean,
  failureReason: string | null,
  req: NextRequest,
  dealershipId: string | null
): Promise<void> {
  try {
    const ipAddress =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const { error } = await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      email,
      success,
      failure_reason: failureReason,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: getDeviceType(userAgent),
      dealership_id: dealershipId,
    });
    if (error) {
      console.error("Failed to log mobile login attempt:", error);
    }
  } catch (err) {
    console.error("Exception logging mobile login attempt:", err);
  }
}

type UserRow = {
  full_name: string | null;
  email: string | null;
  role: string | null;
  phone: string | null;
  avatar: string | null;
  is_platform_admin: boolean | null;
  dealership_id: string | null;
  is_active: boolean | null;
  user_permissions: string[] | null;
  email_verified_at: string | null;
};

export async function loadUserRow(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "full_name, email, role, phone, avatar, is_platform_admin, dealership_id, is_active, user_permissions, email_verified_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

export async function loadMobileMeUser(
  userId: string,
  fallbackEmail: string | null
): Promise<MobileMeUser> {
  const dbProfile = await loadUserRow(userId);

  if (!dbProfile) {
    return {
      id: userId,
      email: fallbackEmail || "",
      role: "user",
      dealership_id: null,
      is_platform_admin: false,
      full_name: fallbackEmail?.split("@")[0] || "User",
      phone: null,
      avatar: null,
      is_active: true,
      user_permissions: [],
      effective_permissions: [],
      dealership_name: null,
      dealership: null,
      subscription: null,
    };
  }

  let dealership_name: string | null = null;
  let dealership: MobileMeDealership | null = null;
  let subscription: MobileMeSubscription | null = null;
  let effectivePermissions: string[] = dbProfile.user_permissions || [];

  if (dbProfile.dealership_id) {
    const trial = await getDealershipTrialState(dbProfile.dealership_id);
    dealership_name = trial.dealership?.name || null;
    subscription = {
      status: trial.dealership?.subscription_status ?? null,
      trial_ends_at: trial.dealership?.trial_ends_at ?? null,
      days_remaining: trial.daysRemaining,
      soft_locked: trial.softLocked,
    };

    const { data: dealerRow } = await supabaseAdmin
      .from("dealerships")
      .select(
        "id, name, business_name, business_address, business_phone, business_email, logo_url, settings"
      )
      .eq("id", dbProfile.dealership_id)
      .maybeSingle();

    if (dealerRow) {
      dealership = {
        id: dealerRow.id as string,
        name: (dealerRow.name as string | null) ?? null,
        business_name: (dealerRow.business_name as string | null) ?? null,
        business_address: (dealerRow.business_address as string | null) ?? null,
        business_phone: (dealerRow.business_phone as string | null) ?? null,
        business_email: (dealerRow.business_email as string | null) ?? null,
        logo_url: (dealerRow.logo_url as string | null) ?? null,
        settings: dealerRow.settings ?? null,
      };
      if (!dealership_name) dealership_name = dealership.name;
    }
  }

  if (
    dbProfile.role &&
    dbProfile.dealership_id &&
    !dbProfile.is_platform_admin
  ) {
    const { data: roleData } = await scopedTable(
      supabaseAdmin,
      "roles",
      tenantScopeFromProfile(
        { dealership_id: dbProfile.dealership_id },
        false
      )
    )
      .select("permissions")
      .eq("name", dbProfile.role)
      .maybeSingle();

    if (roleData?.permissions && Array.isArray(roleData.permissions)) {
      const rolePerms = roleData.permissions as string[];
      if (rolePerms.includes("*")) {
        effectivePermissions = ["*"];
      } else {
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

  return {
    id: userId,
    email: dbProfile.email || fallbackEmail || "",
    role: dbProfile.role || "user",
    dealership_id: dbProfile.dealership_id,
    is_platform_admin: dbProfile.is_platform_admin || false,
    full_name: dbProfile.full_name,
    phone: dbProfile.phone,
    avatar: dbProfile.avatar,
    is_active: dbProfile.is_active !== false,
    user_permissions: dbProfile.user_permissions || [],
    effective_permissions: effectivePermissions,
    dealership_name,
    dealership,
    subscription,
  };
}
