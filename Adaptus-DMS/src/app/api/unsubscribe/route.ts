// app/api/unsubscribe/route.ts — public CASL marketing unsubscribe write
// Prefer signed token from email footer; allow email-only with rate limit for CASL UX.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { checkRateLimit, clientIp } from "@/src/lib/trial";
import {
    normalizeUnsubscribeEmail,
    verifyUnsubscribeToken,
} from "@/src/lib/casl-unsubscribe";

export async function POST(req: NextRequest) {
    try {
        const ip = clientIp(req);
        const rate = checkRateLimit(`unsub:${ip}`, 30, 60 * 60 * 1000);
        if (!rate.allowed) {
            return NextResponse.json(
                { error: "Too many requests. Try again later." },
                {
                    status: 429,
                    headers: { "Retry-After": String(rate.retryAfterSec || 60) },
                }
            );
        }

        const body = await req.json().catch(() => ({}));
        const emailRaw = typeof body.email === "string" ? body.email : "";
        const email = normalizeUnsubscribeEmail(emailRaw);
        const token = typeof body.token === "string" ? body.token : null;

        if (!email || !email.includes("@") || email.length > 254) {
            return NextResponse.json(
                { error: "A valid email is required" },
                { status: 400 }
            );
        }

        const tokenOk = await verifyUnsubscribeToken(email, token);
        // Token preferred; email-only still allowed (rate-limited) for CASL.
        if (!tokenOk && token) {
            return NextResponse.json(
                {
                    error:
                        "Invalid unsubscribe token. Use the link from your marketing email.",
                },
                { status: 403 }
            );
        }

        const now = new Date().toISOString();
        const fullPatch: Record<string, unknown> = {
            marketing_consent: false,
            marketing_consent_at: null,
            marketing_unsubscribed_at: now,
            marketing_consent_ip: ip,
            marketing_consent_source: tokenOk
                ? "unsubscribe_email_link"
                : "unsubscribe_page",
            sms_consent: false,
            sms_consent_at: null,
        };

        let { data: updated, error: updError } = await supabaseAdmin
            .from("customers")
            .update(fullPatch)
            .ilike("email", email)
            .select("id");

        if (
            updError &&
            /column|marketing_unsubscribed|marketing_consent_ip|sms_consent/i.test(
                updError.message || ""
            )
        ) {
            const retry = await supabaseAdmin
                .from("customers")
                .update({
                    marketing_consent: false,
                    marketing_consent_at: null,
                })
                .ilike("email", email)
                .select("id");
            updated = retry.data;
            updError = retry.error;
        }

        if (updError) throw updError;

        const count = updated?.length || 0;
        return NextResponse.json({
            success: true,
            updated: count,
            message:
                count > 0
                    ? "You have been unsubscribed from marketing email and SMS marketing. Transactional messages may still be sent when required. (SMS transport is not active in this product yet.)"
                    : "If this email is on file, marketing preferences have been updated.",
        });
    } catch (error: unknown) {
        console.error("Unsubscribe write failed:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 }
        );
    }
}
