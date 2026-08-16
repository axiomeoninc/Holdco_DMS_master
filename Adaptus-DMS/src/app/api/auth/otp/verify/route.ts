// POST /api/auth/otp/verify
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { checkRateLimit, clientIp, sha256Hex } from "@/src/lib/trial";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const purpose =
      body?.purpose === "login" || body?.purpose === "signup" ? body.purpose : "signup";

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const ip = clientIp(req);
    const limit = checkRateLimit(`otp-verify:${ip}:${email}`, 20, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Try again later." },
        { status: 429 }
      );
    }

    const codeHash = await sha256Hex(code);
    const nowIso = new Date().toISOString();

    const { data: otp } = await supabaseAdmin
      .from("email_otp")
      .select("*")
      .eq("email", email)
      .eq("purpose", purpose)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    if (otp.attempts >= 8) {
      return NextResponse.json(
        { error: "Too many invalid attempts. Request a new code." },
        { status: 429 }
      );
    }

    if (new Date(otp.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin
        .from("email_otp")
        .update({ consumed_at: nowIso })
        .eq("id", otp.id);
      return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
    }

    if (otp.code_hash !== codeHash) {
      await supabaseAdmin
        .from("email_otp")
        .update({ attempts: (otp.attempts || 0) + 1 })
        .eq("id", otp.id);
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await supabaseAdmin
      .from("email_otp")
      .update({ consumed_at: nowIso })
      .eq("id", otp.id);

    if (otp.user_id) {
      await supabaseAdmin
        .from("users")
        .update({ email_verified_at: nowIso })
        .eq("id", otp.user_id);

      await supabaseAdmin.auth.admin.updateUserById(otp.user_id, {
        email_confirm: true,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Email verified. You can sign in now.",
    });
  } catch (err) {
    console.error("otp/verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
