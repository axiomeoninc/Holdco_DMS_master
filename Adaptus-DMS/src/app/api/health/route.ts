import { NextResponse } from "next/server";

/**
 * Public liveness probe (middleware allowlisted).
 * No auth, no DB — used by uptime checks and QA unauth matrix.
 */
export async function GET() {
    return NextResponse.json({
        ok: true,
        service: "flashfender-dms",
        ts: Date.now(),
    });
}
