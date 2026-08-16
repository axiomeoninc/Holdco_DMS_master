// POST /api/auth/reset-password
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { checkRateLimit, clientIp, isStrongPassword, sha256Hex } from "@/src/lib/trial";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !token || !password) {
      return NextResponse.json(
        { error: "Email, token, and password are required" },
        { status: 400 }
      );
    }

    const pwErr = isStrongPassword(password);
    if (pwErr) {
      return NextResponse.json({ error: pwErr }, { status: 400 });
    }

    const ip = clientIp(req);
    const limit = checkRateLimit(`reset:${ip}:${email}`, 10, 30 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many reset attempts. Try again later." },
        { status: 429 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const tokenHash = await sha256Hex(token);
    const { data: row } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("token_hash", tokenHash)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
    });

    if (updateError) {
      console.error("reset-password update failed:", updateError);
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    return NextResponse.json({
      ok: true,
      message: "Password updated. You can sign in now.",
    });
  } catch (err) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
