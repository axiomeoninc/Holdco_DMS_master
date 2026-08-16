// app/api/payments/config/route.ts
// GET — provider configuration state (honest: configured=false when Stripe is
// not fully set up). Never exposes the secret key.

import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { getPaymentProviderConfig } from "@/src/lib/payments";

export async function GET(req: NextRequest) {
    const auth = await requireDealershipAccess(req);
    if (auth.error || !auth.profile) {
        return NextResponse.json(
            { error: auth.error || "Unauthorized" },
            { status: auth.status || 401 }
        );
    }
    const config = getPaymentProviderConfig();
    return NextResponse.json({ data: config });
}
