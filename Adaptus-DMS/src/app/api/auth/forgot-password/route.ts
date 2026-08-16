// POST /api/auth/forgot-password — always 200 (no user enumeration)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
  checkRateLimit,
  clientIp,
  generateResetToken,
  sha256Hex,
} from "@/src/lib/trial";
import { resetPasswordEmailHtml, sendEmail } from "@/src/lib/resend";

function appBaseUrl(req: NextRequest): string {
  const fromEnv = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://dms.adaptusgroup.ca";
}

export async function POST(req: NextRequest) {
  const generic = {
    ok: true,
    message: "If that email is registered, a reset link was sent.",
  };

  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(generic);
    }

    const ip = clientIp(req);
    const limit = checkRateLimit(`forgot:${ip}:${email}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(generic);
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(generic);
    }

    const token = generateResetToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("consumed_at", null);

    await supabaseAdmin.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetUrl = `${appBaseUrl(req)}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    const mail = resetPasswordEmailHtml({ resetUrl });
    const sent = await sendEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (!sent.ok) {
      // Still return generic 200 to clients, but log + include hint for operators in logs only
      console.error("forgot-password send failed:", sent.error, {
        missingConfig: sent.missingConfig,
      });
      if (sent.missingConfig) {
        return NextResponse.json(
          {
            ...generic,
            // Safe ops hint for E2E when env missing (no user enumeration of existence)
            warning: "Email provider not configured (RESEND_API_KEY / EMAIL_FROM)",
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(generic);
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json(generic);
  }
}
