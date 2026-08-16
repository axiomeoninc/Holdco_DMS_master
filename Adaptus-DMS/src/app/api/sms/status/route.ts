import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { verifyTwilioWebhook } from "@/src/lib/sms/opt-out";
import { isTwilioConfigured } from "@/src/lib/sms/config";

/**
 * Twilio status callback — records the provider's real delivery state.
 * Sent messages are matched by provider_sid. An honest 501 is returned when
 * Twilio is not configured (nothing to verify against).
 */
export async function POST(req: NextRequest) {
    const rawBody = await req.text();

    if (!isTwilioConfigured()) {
        return NextResponse.json(
            {
                error:
                    "SMS provider not configured. Twilio status callbacks cannot be verified.",
                code: "SMS_NOT_CONFIGURED",
            },
            { status: 501 }
        );
    }

    const url = `${req.url.split("?")[0]}`;
    const signature = req.headers.get("x-twilio-signature");
    const verified = await verifyTwilioWebhook(rawBody, signature, url);
    if (!verified) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const params = new URLSearchParams(rawBody);
    const sid = (params.get("MessageSid") || "").trim();
    const providerStatus = (params.get("MessageStatus") || "").trim();
    const errorCode = (params.get("ErrorCode") || "").trim();

    if (!sid) {
        return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
    }

    try {
        const { data: message } = await supabaseAdmin
            .from("sms_messages")
            .select("id, dealership_id, phone")
            .eq("provider_sid", sid)
            .maybeSingle();

        if (!message) {
            return NextResponse.json({ error: "Unknown message" }, { status: 404 });
        }

        const mapped: Record<string, string> = {
            delivered: "delivered",
            sent: "sent",
            failed: "failed",
            undelivered: "failed",
        };
        const status = mapped[providerStatus] || providerStatus || "sent";

        const update: Record<string, unknown> = {
            status,
            provider_status: providerStatus,
            delivered_at: status === "delivered" ? new Date().toISOString() : null,
        };
        if (status === "failed") {
            update.error = errorCode
                ? `Twilio error ${errorCode}`
                : "Delivery failed (provider)";
        }

        await supabaseAdmin
            .from("sms_messages")
            .update(update)
            .eq("id", message.id);

        // Provider-reported failed delivery on a marketing message: if the
        // body indicates an opt-out we already handled at inbound; nothing
        // further is needed here beyond the honest status log.
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        console.error("SMS status error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
