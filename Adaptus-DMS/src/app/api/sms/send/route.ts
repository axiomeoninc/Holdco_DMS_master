import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { assertSmsConsent, SmsConsentError } from "@/src/lib/sms-consent";
import { sendSmsMessage } from "@/src/lib/sms/provider";
import { SMS_NOT_CONFIGURED_MESSAGE } from "@/src/lib/sms/config";

/**
 * SMS send endpoint — real provider path (Twilio) behind CASL sms_consent,
 * dealership ownership, and quiet-hours enforcement.
 *
 * Honest behavior:
 *  - Consent missing        → 403 SMS_CONSENT_REQUIRED
 *  - Quiet hours            → 409 SMS_QUIET_HOURS (recorded blocked)
 *  - Provider not configured → 501 SMS_NOT_CONFIGURED (nothing sent)
 *  - Provider failure       → 502 SMS_SEND_FAILED (recorded failed)
 *  - Real send              → 200 with provider SID (recorded sent)
 */
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const writeScope = tenantScopeFromRequest(tenant, req);
        const rooftop = requireWriteDealershipId(writeScope);

        const body = await req.json().catch(() => ({}));
        const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
        if (!customerId) {
            return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
        }
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) {
            return NextResponse.json({ error: "message is required" }, { status: 400 });
        }
        if (message.length > 1600) {
            return NextResponse.json(
                { error: "message exceeds 1600 characters" },
                { status: 400 }
            );
        }
        const marketing = body.marketing !== false;
        const ignoreQuietHours = body.ignore_quiet_hours === true;

        const { data: customer, error } = await scopedTable(
            supabase,
            "customers",
            writeScope
        )
            .select("id, phone, sms_consent, dealership_id")
            .eq("id", customerId)
            .maybeSingle();

        if (error || !customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        try {
            assertSmsConsent(customer);
        } catch (e) {
            const msg = e instanceof SmsConsentError ? e.message : "SMS consent required";
            return NextResponse.json(
                { error: msg, code: "SMS_CONSENT_REQUIRED", sent: false },
                { status: 403 }
            );
        }

        const result = await sendSmsMessage(supabase, {
            dealershipId: rooftop,
            customer,
            body: message,
            marketing,
            ignoreQuietHours,
            recordBlocked: true,
            source: "api-send",
        });

        if (result.ok) {
            return NextResponse.json({
                data: {
                    sms_message_id: result.smsMessageId,
                    provider_sid: result.providerSid,
                },
                sent: true,
                consented: true,
            });
        }

        switch (result.code) {
            case "QUIET_HOURS":
                return NextResponse.json(
                    {
                        error: result.error,
                        code: "SMS_QUIET_HOURS",
                        sent: false,
                        blocked: true,
                        sms_message_id: result.smsMessageId,
                    },
                    { status: 409 }
                );
            case "NOT_CONFIGURED":
                return NextResponse.json(
                    {
                        error: SMS_NOT_CONFIGURED_MESSAGE,
                        code: "SMS_NOT_CONFIGURED",
                        consented: true,
                        sent: false,
                    },
                    { status: 501 }
                );
            default:
                return NextResponse.json(
                    {
                        error: result.error,
                        code: "SMS_SEND_FAILED",
                        sent: false,
                        sms_message_id: result.smsMessageId,
                    },
                    { status: 502 }
                );
        }
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS send error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
