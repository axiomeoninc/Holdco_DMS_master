// POST /api/auth/otp/send
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
  checkRateLimit,
  clientIp,
  generateOtpCode,
  sha256Hex,
} from "@/src/lib/trial";
import { otpEmailHtml, sendEmail } from "@/src/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const purpose =
      body?.purpose === "login" || body?.purpose === "signup" ? body.purpose : "signup";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const ip = clientIp(req);
    const limit = checkRateLimit(`otp-send:${ip}:${email}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many OTP requests. Try again later." },
        { status: 429 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, dealership_id, email_verified_at")
      .eq("email", email)
      .maybeSingle();

    // Always 200-shaped success to reduce enumeration; only send if user exists.
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: "If that email is registered, a code was sent.",
      });
    }

    const code = generateOtpCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Invalidate prior unused OTPs for this email+purpose
    await supabaseAdmin
      .from("email_otp")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", email)
      .eq("purpose", purpose)
      .is("consumed_at", null);

    await supabaseAdmin.from("email_otp").insert({
      email,
      code_hash: codeHash,
      purpose,
      dealership_id: user.dealership_id,
      user_id: user.id,
      expires_at: expiresAt,
    });

    const mail = otpEmailHtml({ code, purpose });
    const sent = await sendEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (!sent.ok) {
      return NextResponse.json(
        {
          error: sent.error,
          missing_config: Boolean(sent.missingConfig),
        },
        { status: sent.missingConfig ? 503 : 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "If that email is registered, a code was sent.",
    });
  } catch (err) {
    console.error("otp/send error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
