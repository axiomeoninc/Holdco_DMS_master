import { NextRequest, NextResponse } from "next/server";
import {
    pickSupabaseClient,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import {
    listWebhookEndpoints,
    upsertWebhookEndpoint,
    WEBHOOK_EVENTS,
} from "@/src/lib/api/webhooks";

/**
 * Webhook endpoint config — list or create for the caller's dealership.
 * Admin/Manager only for writes.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        void pickSupabaseClient;
        const result = await listWebhookEndpoints(auth.dealership_id);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
            data: { webhooks: result.webhooks, events: WEBHOOK_EVENTS },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Webhooks list error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const isAdmin =
            auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const url = typeof body.url === "string" ? body.url : "";
        const events: string[] = Array.isArray(body.events) ? body.events : [];
        const secret = typeof body.secret === "string" ? body.secret : null;

        const result = await upsertWebhookEndpoint(auth.dealership_id, {
            url,
            events,
            secret,
            active: body.active !== false,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ data: result.webhook }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Webhooks create error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
