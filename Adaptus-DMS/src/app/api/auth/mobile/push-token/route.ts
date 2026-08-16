// POST /api/auth/mobile/push-token
// Upserts Expo push token for the authenticated user into push_tokens.
// Requires migration mobile_push_tokens.sql (operator-applied).

import { NextRequest, NextResponse } from "next/server";
import {
  denyIfTrialExpired,
  getCurrentUser,
  jsonAuthError,
  pickSupabaseClient,
} from "@/src/lib/auth-helpers";
import { parsePushTokenBody, readJsonBody } from "@/src/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentUser(req);
    if (auth.error || !auth.user || !auth.profile) {
      return jsonAuthError(auth);
    }

    if (!auth.profile.is_active) {
      return NextResponse.json(
        { error: "Forbidden - User account is inactive" },
        { status: 403 }
      );
    }

    const trialDeny = await denyIfTrialExpired(req, auth.profile);
    if (trialDeny) return trialDeny;

    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }

    const parsed = parsePushTokenBody(parsedBody.value);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { token, platform } = parsed.value;
    const { supabase } = pickSupabaseClient(req, auth.profile);

    const { error: upsertError } = await supabase.from("push_tokens").upsert(
      {
        user_id: auth.profile.id,
        dealership_id: auth.profile.dealership_id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

    if (upsertError) {
      console.error("Mobile push-token upsert error:", upsertError.message);
      return NextResponse.json(
        { error: "Failed to save push token" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error("Mobile push-token error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
