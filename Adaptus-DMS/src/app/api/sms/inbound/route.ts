import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { verifyTwilioWebhook, applyPhoneOptOut, isOptOutKeyword } from "@/src/lib/sms/opt-out";
import { OPT_OUT_CONFIRMATION } from "@/src/lib/sms/config";
import { isTwilioConfigured } from "@/src/lib/sms/config";
import { sendViaTwilio } from "@/src/lib/sms/twilio";

const XML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/**
 * Twilio inbound SMS webhook.
 * - Signature verification is mandatory. When TWILIO_AUTH_TOKEN is missing we
 *   return an honest 501 instead of trusting an unverified webhook.
 * - STOP/opt-out keywords flip sms_consent=false in real time and stop active
 *   SMS sequence enrollments; a confirmation text is sent back.
 * - All inbound messages are recorded to sms_messages (direction=inbound).
 */
export async function POST(req: NextRequest) {
    const rawBody = await req.text();

    if (!isTwilioConfigured()) {
        return NextResponse.json(
            {
                error:
                    "SMS provider not configured. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER. Inbound webhook verification unavailable.",
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
    const from = (params.get("From") || "").trim();
    const to = (params.get("To") || "").trim();
    const body = (params.get("Body") || "").trim();
    const messageSid = (params.get("MessageSid") || "").trim();

    if (!from) {
        return new NextResponse(XML_EMPTY, {
            status: 200,
            headers: { "Content-Type": "text/xml" },
        });
    }

    try {
        // Resolve the dealership that owns the receiving Twilio number.
        const { data: dealers } = await supabaseAdmin
            .from("dealerships")
            .select("id, settings")
            .filter("settings->>sms_from_number", "eq", to)
            .limit(1);
        const dealer = (dealers || [])[0] as
            | { id: string; settings: Record<string, unknown> | null }
            | undefined;

        if (!dealer) {
            // No matching dealership for this number — record nothing, stay silent.
            return new NextResponse(XML_EMPTY, {
                status: 200,
                headers: { "Content-Type": "text/xml" },
            });
        }

        // Find the customer by phone within this dealership.
        const phoneDigits = from.replace(/[^\d+]/g, "");
        const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id, dealership_id, sms_consent")
            .eq("dealership_id", dealer.id)
            .ilike("phone", phoneDigits)
            .limit(1)
            .maybeSingle();

        const isOptOut = isOptOutKeyword(body);
        const status = isOptOut ? "opt_out" : "received";

        await supabaseAdmin.from("sms_messages").insert({
            dealership_id: dealer.id,
            customer_id: customer?.id || null,
            direction: "inbound",
            phone: from,
            body,
            status,
            provider: "twilio",
            provider_sid: messageSid || null,
            consent_checked: false,
            quiet_hours_blocked: false,
            created_at: new Date().toISOString(),
        });

        if (isOptOut) {
            await applyPhoneOptOut(supabaseAdmin, {
                dealershipId: dealer.id,
                phone: from,
                source: "inbound_stop",
            });
            // Confirmation is transactional (opt-out notice), not marketing.
            const fromNumber =
                typeof dealer.settings?.sms_from_number === "string"
                    ? dealer.settings.sms_from_number
                    : "";
            if (fromNumber) {
                await sendViaTwilio({ to: from, from: fromNumber, body: OPT_OUT_CONFIRMATION });
            }
        }

        return new NextResponse(XML_EMPTY, {
            status: 200,
            headers: { "Content-Type": "text/xml" },
        });
    } catch (error: unknown) {
        console.error("SMS inbound error:", error);
        return new NextResponse(XML_EMPTY, {
            status: 200,
            headers: { "Content-Type": "text/xml" },
        });
    }
}
