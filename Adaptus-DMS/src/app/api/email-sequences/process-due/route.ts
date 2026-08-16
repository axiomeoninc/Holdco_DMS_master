/**
 * Alias of /api/email-sequences/send-due (Wave M1).
 * Prefer send-due — kept for docs that mention process-due.
 * GET+POST both supported (same as send-due) for cron pingers.
 */
import { GET as sendDueGet, POST as sendDuePost } from "../send-due/route";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    return sendDuePost(req);
}

export async function GET(req: NextRequest) {
    return sendDueGet(req);
}
