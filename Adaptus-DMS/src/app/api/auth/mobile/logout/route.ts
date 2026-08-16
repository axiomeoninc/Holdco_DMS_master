// POST /api/auth/mobile/logout — clear HttpOnly session cookies.

import { NextRequest, NextResponse } from "next/server";
import {
  applyPendingCookies,
  createMobileSessionClient,
} from "@/src/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const { supabase, pendingCookies, secure } =
      await createMobileSessionClient(req);

    await supabase.auth.signOut();

    const response = NextResponse.json({ data: { ok: true } });
    applyPendingCookies(response, pendingCookies, { secure, expire: true });
    return response;
  } catch (err) {
    console.error("Mobile logout error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
