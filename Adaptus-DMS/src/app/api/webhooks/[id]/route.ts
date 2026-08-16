import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import {
    deleteWebhookEndpoint,
    listWebhookEndpoints,
    dispatchToEndpoint,
    upsertWebhookEndpoint,
} from "@/src/lib/api/webhooks";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(req: NextRequest) {
    const auth = await requireDealershipAccess(req);
    if (auth.error || !auth.profile) {
        return { auth, deny: NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 }) };
    }
    const isAdmin =
        auth.profile.is_platform_admin ||
        auth.profile.role === "Admin" ||
        auth.profile.role === "Manager";
    if (!isAdmin) {
        return { auth, deny: NextResponse.json({ error: "Forbidden - Admin or Manager required" }, { status: 403 }) };
    }
    return { auth, deny: null as null };
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { auth, deny } = await requireAdmin(req);
        if (deny) return deny;

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const url = typeof body.url === "string" ? body.url : undefined;
        const events = Array.isArray(body.events) ? (body.events as string[]) : undefined;
        const secret = typeof body.secret === "string" ? body.secret : undefined;
        const active = typeof body.active === "boolean" ? body.active : undefined;

        const result = await upsertWebhookEndpoint(auth.dealership_id, {
            id,
            url: url ?? "",
            events: events ?? [],
            secret: secret ?? null,
            active,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ data: result.webhook, message: "Webhook updated." });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Webhook update error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { auth, deny } = await requireAdmin(req);
        if (deny) return deny;

        const { id } = await params;
        const result = await deleteWebhookEndpoint(auth.dealership_id, id);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ data: { id }, message: "Webhook deleted." });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Webhook delete error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * POST /api/webhooks/[id] with { action: "test" } — fires a synthetic
 * `deal.created` ping to the endpoint so the dealer can verify connectivity.
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { auth, deny } = await requireAdmin(req);
        if (deny) return deny;

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        if (body?.action !== "test") {
            return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
        }

        const result = await listWebhookEndpoints(auth.dealership_id);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
        const webhook = result.webhooks.find((w) => w.id === id);
        if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const outcome = await dispatchToEndpoint(webhook, {
            event: "deal.created",
            payload: {
                test: true,
                message: "Test webhook from FlashFender",
                dealership_id: auth.dealership_id,
            },
            dealershipId: auth.dealership_id,
        });

        return NextResponse.json({
            data: outcome,
            message: outcome.ok ? "Test delivered." : "Test failed — check endpoint URL and secret.",
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Webhook test error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
