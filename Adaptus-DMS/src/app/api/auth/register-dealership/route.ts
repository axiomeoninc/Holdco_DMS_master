// POST /api/auth/register-dealership
// Public self-serve SaaS signup. Creates dealership (trialing 7d) + admin user.
// OTP must be verified before login (email_confirm=false until verify).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
  checkRateLimit,
  clientIp,
  generateOtpCode,
  isStrongPassword,
  sha256Hex,
  slugify,
  trialWindowFromNow,
} from "@/src/lib/trial";
import { otpEmailHtml, sendEmail } from "@/src/lib/resend";

type RegisterBody = {
  dealership_name?: string;
  slug?: string;
  phone?: string;
  website?: string;
  address_street?: string;
  address_city?: string;
  address_province?: string;
  address_postal?: string;
  address_country?: string;
  timezone?: string;
  business_number?: string;
  accept_terms?: boolean;
  admin_full_name?: string;
  admin_email?: string;
  admin_password?: string;
  admin_phone?: string;
};

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limit = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const body = (await req.json()) as RegisterBody;
    const dealershipName = (body.dealership_name || "").trim();
    const adminEmail = (body.admin_email || "").trim().toLowerCase();
    const adminFullName = (body.admin_full_name || "").trim();
    const adminPassword = body.admin_password || "";
    const adminPhone = (body.admin_phone || "").trim() || null;
    const phone = (body.phone || "").trim() || null;
    const website = (body.website || "").trim() || null;
    const timezone = (body.timezone || "America/Vancouver").trim();
    const businessNumber = (body.business_number || "").trim() || null;

    if (!dealershipName) {
      return NextResponse.json({ error: "Dealership name is required" }, { status: 400 });
    }
    if (!adminFullName) {
      return NextResponse.json({ error: "Admin full name is required" }, { status: 400 });
    }
    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: "Valid admin email is required" }, { status: 400 });
    }
    const pwErr = isStrongPassword(adminPassword);
    if (pwErr) {
      return NextResponse.json({ error: pwErr }, { status: 400 });
    }
    if (!body.accept_terms) {
      return NextResponse.json(
        { error: "You must accept Terms and Privacy to continue" },
        { status: 400 }
      );
    }

    const emailLimit = checkRateLimit(`register-email:${adminEmail}`, 3, 60 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts for this email. Try again later." },
        { status: 429 }
      );
    }

    let slug = slugify((body.slug || dealershipName).trim());
    if (!slug) slug = `dealer-${Date.now().toString(36)}`;

    const { data: existingSlug } = await supabaseAdmin
      .from("dealerships")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingSlug) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", adminEmail)
      .maybeSingle();
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const trial = trialWindowFromNow();
    const nowIso = new Date().toISOString();

    const { data: dealership, error: dealershipError } = await supabaseAdmin
      .from("dealerships")
      .insert({
        name: dealershipName,
        slug,
        subdomain: slug,
        business_name: dealershipName,
        business_phone: phone,
        business_email: adminEmail,
        billing_email: adminEmail,
        website,
        timezone,
        address_street: (body.address_street || "").trim() || null,
        address_city: (body.address_city || "").trim() || null,
        address_province: (body.address_province || "").trim() || null,
        address_postal: (body.address_postal || "").trim() || null,
        address_country: (body.address_country || "CA").trim() || "CA",
        business_number: businessNumber,
        business_address: [
          body.address_street,
          body.address_city,
          body.address_province,
          body.address_postal,
          body.address_country || "CA",
        ]
          .filter(Boolean)
          .join(", ") || null,
        status: "Trial",
        subscription_status: "trialing",
        trial_starts_at: trial.trial_starts_at,
        trial_ends_at: trial.trial_ends_at,
        terms_accepted_at: nowIso,
      })
      .select("id, name, slug, subscription_status, trial_ends_at")
      .single();

    if (dealershipError || !dealership) {
      if (dealershipError?.code === "23505") {
        return NextResponse.json(
          { error: "A dealership with this slug already exists" },
          { status: 409 }
        );
      }
      console.error("register-dealership insert failed:", dealershipError);
      return NextResponse.json({ error: "Failed to create dealership" }, { status: 500 });
    }

    await supabaseAdmin.from("subscriptions").insert({
      dealership_id: dealership.id,
      plan_name: "Trial",
      plan_price: 0,
      billing_cycle: "monthly",
      status: "Trial",
      trial_ends_at: trial.trial_ends_at,
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: false,
      user_metadata: {
        full_name: adminFullName,
        role: "Admin",
        dealership_id: dealership.id,
      },
    });

    if (authError || !authData.user) {
      // Roll back dealership to avoid orphans
      await supabaseAdmin.from("dealerships").delete().eq("id", dealership.id);
      console.error("register-dealership auth create failed:", authError);
      const msg = authError?.message || "Failed to create admin user";
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email: adminEmail,
      full_name: adminFullName,
      phone: adminPhone,
      role: "Admin",
      dealership_id: dealership.id,
      is_active: true,
      email_verified_at: null,
    });

    if (profileError) {
      console.error("register-dealership profile insert failed:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from("dealerships").delete().eq("id", dealership.id);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    const defaultRoles = [
      { name: "Admin", description: "Full access to dealership", is_system: true, permissions: ["*"] },
      {
        name: "Manager",
        description: "Manage inventory, sales, and staff",
        is_system: true,
        permissions: ["deals:*", "vehicles:*", "customers:*", "leads:*"],
      },
      {
        name: "Salesperson",
        description: "Manage assigned leads and deals",
        is_system: true,
        permissions: ["leads:read", "leads:write", "deals:read", "deals:write"],
      },
      {
        name: "Staff",
        description: "Limited access",
        is_system: true,
        permissions: ["deals:read", "vehicles:read", "customers:read"],
      },
    ];

    for (const role of defaultRoles) {
      await supabaseAdmin.from("roles").insert({
        dealership_id: dealership.id,
        ...role,
      });
    }

    // Issue signup OTP — login blocked until verified
    const code = generateOtpCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin.from("email_otp").insert({
      email: adminEmail,
      code_hash: codeHash,
      purpose: "signup",
      dealership_id: dealership.id,
      user_id: authData.user.id,
      expires_at: expiresAt,
    });

    const mail = otpEmailHtml({ code, purpose: "signup" });
    const sent = await sendEmail({
      to: adminEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    return NextResponse.json(
      {
        data: {
          dealership_id: dealership.id,
          slug: dealership.slug,
          trial_ends_at: dealership.trial_ends_at,
          email: adminEmail,
          otp_sent: sent.ok,
          otp_required: true,
          ...(sent.ok
            ? {}
            : {
                otp_error: sent.error,
                resend_configured: !sent.missingConfig,
              }),
        },
        message: sent.ok
          ? "Dealership created. Check your email for the verification code."
          : "Dealership created. Email could not be sent — use /api/auth/otp/send after configuring Resend, or contact support.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("register-dealership error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
