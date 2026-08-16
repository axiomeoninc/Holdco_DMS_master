// Integration status (env-gated). Never returns secret values.
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    resolveTenantDealershipId,
    scopedTable,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { isResendConfigured } from "@/src/lib/resend";
import { getFacebookEnv } from "@/src/lib/social/facebook";
import { getCarfaxEnv } from "@/src/lib/carfax";
import { isFlashAiConfigured } from "@/src/lib/ai/llm";
import { AI_NOT_CONFIGURED_MESSAGE } from "@/src/lib/ai/guard";
import { isTwilioConfigured } from "@/src/lib/sms/config";
import { resolveEmailFrom, type ResolvedEmailFrom } from "@/src/lib/email/from";

type IntegrationStatus = {
    id: string;
    name: string;
    description: string;
    configured: boolean;
    status: "live" | "missing_env" | "partial" | "url_only";
    missing: string[];
    notes: string;
    href?: string;
};

export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);
        const dealershipId = resolveTenantDealershipId(scope);

        const facebook = getFacebookEnv();
        let resendOk = isResendConfigured();
        const carfax = getCarfaxEnv();
        const flashAiOk = isFlashAiConfigured();

        let facebookConnected = false;
        let facebookPageName: string | null = null;
        let autotraderCompanySet = false;
        let autotraderLastExport: string | null = null;
        let resolvedEmailFrom: ResolvedEmailFrom | null = null;
        if (dealershipId) {
            const { data: fbRow } = await scopedTable(
                supabase,
                "facebook_business_account",
                scope
            )
                .select("page_name, is_active, access_token")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            facebookConnected = Boolean(
                fbRow?.is_active && fbRow?.access_token
            );
            facebookPageName = fbRow?.page_name || null;

            const { data: dealer } = await supabase
                .from("dealerships")
                .select("settings")
                .eq("id", dealershipId)
                .maybeSingle();
            const settings = (dealer?.settings || {}) as Record<string, unknown>;
            resendOk = isResendConfigured(settings);
            resolvedEmailFrom = resolveEmailFrom(settings);
            autotraderCompanySet = Boolean(
                (typeof settings.autotrader_company_id === "string" &&
                    settings.autotrader_company_id.trim()) ||
                    (typeof settings.autotrader_companyId === "string" &&
                        settings.autotrader_companyId.trim())
            );
            const syndication =
                typeof settings.syndication === "object" &&
                settings.syndication !== null
                    ? (settings.syndication as Record<string, unknown>)
                    : {};
            const atMeta =
                typeof syndication.autotrader === "object" &&
                syndication.autotrader !== null
                    ? (syndication.autotrader as Record<string, unknown>)
                    : {};
            autotraderLastExport =
                typeof atMeta.last_export_at === "string"
                    ? atMeta.last_export_at
                    : null;
        }

        const metaStatus: IntegrationStatus["status"] = !facebook.oauth_ready
            ? "missing_env"
            : facebookConnected
              ? "live"
              : "partial";

        const twilioOk = isTwilioConfigured();
        const missingTwilio = [
            ...(!process.env.TWILIO_ACCOUNT_SID ? ["TWILIO_ACCOUNT_SID"] : []),
            ...(!process.env.TWILIO_AUTH_TOKEN ? ["TWILIO_AUTH_TOKEN"] : []),
            ...(!process.env.TWILIO_FROM_NUMBER ? ["TWILIO_FROM_NUMBER"] : []),
        ];

        let webhookCount = 0;
        let apiTokenCount = 0;
        let smsFromNumber: string | null = null;
        let quietHoursEnabled = false;
        if (dealershipId) {
            const { data: dealer } = await supabase
                .from("dealerships")
                .select("settings")
                .eq("id", dealershipId)
                .maybeSingle();
            const settings = (dealer?.settings || {}) as Record<string, unknown>;
            if (Array.isArray(settings.webhooks)) webhookCount = settings.webhooks.length;
            if (Array.isArray(settings.api_tokens)) apiTokenCount = settings.api_tokens.length;
            smsFromNumber =
                typeof settings.sms_from_number === "string" && settings.sms_from_number.trim()
                    ? settings.sms_from_number
                    : null;
            const qh =
                typeof settings.sms_quiet_hours === "object" && settings.sms_quiet_hours !== null
                    ? (settings.sms_quiet_hours as Record<string, unknown>)
                    : {};
            quietHoursEnabled = qh.enabled === true;
        }

        const resendDealerOverride = resolvedEmailFrom?.source === "dealer";

        const integrations: IntegrationStatus[] = [
            {
                id: "sms_twilio",
                name: "SMS / Texting (Twilio)",
                description:
                    "Real SMS sender behind CASL/TCPA consent — quiet hours, real-time STOP opt-out, stage-triggered follow-up.",
                configured: twilioOk,
                status: twilioOk ? "live" : "missing_env",
                missing: missingTwilio,
                notes: twilioOk
                    ? `Twilio configured${smsFromNumber ? ` (from ${smsFromNumber})` : ""}. Sends are consent + quiet-hours gated and logged honestly.${quietHoursEnabled ? " Quiet hours on." : ""}`
                    : "Not configured — add via wrangler when ready. Consent checks still run; no fake Sent.",
            },
            {
                id: "open_api",
                name: "Open API (read)",
                description:
                    "Public read API for inventory / leads / deals scoped by API token (ffapi_…).",
                configured: true,
                status: apiTokenCount > 0 ? "live" : "url_only",
                missing: [],
                href: "/settings/integrations",
                notes:
                    apiTokenCount > 0
                        ? `${apiTokenCount} token${apiTokenCount === 1 ? "" : "s"} active. GET /api/external/v1/{inventory|leads|deals} with Authorization: Bearer <token>.`
                        : "Create an API token below to expose read-only dealership data. Nothing is exposed until you do.",
            },
            {
                id: "webhooks",
                name: "Webhooks",
                description:
                    "Event delivery for deal.created, lead.created, inventory.updated, payment.received.",
                configured: true,
                status: webhookCount > 0 ? "live" : "url_only",
                missing: [],
                href: "/settings/integrations",
                notes:
                    webhookCount > 0
                        ? `${webhookCount} endpoint${webhookCount === 1 ? "" : "s"} configured. Payloads signed with X-FF-Signature (HMAC-SHA256); deliveries logged.`
                        : "Add a webhook endpoint below to receive events. Nothing is delivered until you do.",
            },
            {
                id: "data_export",
                name: "Full data export",
                description:
                    "One-click JSON + XLSX export of every dealership table — your data, always.",
                configured: true,
                status: "url_only",
                missing: [],
                href: "/settings/integrations",
                notes: "Download JSON or Excel from the Export card below (Admin/Manager).",
            },
            {
                id: "flash_ai",
                name: "Flash AI",
                description:
                    "Desk Copilot, listing drafts, follow-ups, NL inventory search, Ontario disclosure helper.",
                configured: flashAiOk,
                status: flashAiOk ? "live" : "missing_env",
                missing: flashAiOk ? [] : [],
                notes: flashAiOk
                    ? "Flash AI · configured. Drafts never auto-send."
                    : AI_NOT_CONFIGURED_MESSAGE,
            },
            {
                id: "resend",
                name: "Resend (email)",
                description:
                    "OTP, password reset, trial mail, and CRM lead email sequences.",
                configured: resendOk,
                status: resendOk ? "live" : "missing_env",
                missing: [
                    ...(!process.env.RESEND_API_KEY ? ["RESEND_API_KEY"] : []),
                    ...(!process.env.EMAIL_FROM && !resendDealerOverride
                        ? [
                              "EMAIL_FROM (or set a dealership email_from in Settings → Business)",
                          ]
                        : []),
                ],
                href: "/email-sequences",
                notes: resendOk
                    ? resendDealerOverride
                        ? "Worker env has RESEND_API_KEY. From-address is set per dealership (Settings → Business → Email); the domain must be verified with Resend before sends go out."
                        : "Worker env has RESEND_API_KEY and EMAIL_FROM. CRM sequences can send from Lead Center / Email sequences."
                    : "Not configured — add via wrangler when ready. Enroll works; sends stay blocked (no fake Sent). Do not invent keys.",
            },
            {
                id: "meta_facebook",
                name: "Meta / Facebook",
                description:
                    "Social posting — connect a Facebook Page to publish & schedule.",
                configured: facebook.oauth_ready,
                status: metaStatus,
                missing: facebook.missing,
                href: "/social",
                notes: !facebook.oauth_ready
                    ? "Not configured — add via wrangler when ready (FACEBOOK_APP_ID/SECRET; optional FACEBOOK_REDIRECT_URI, SOCIAL_CRON_SECRET). Drafts OK; Connect stays disabled."
                    : facebookConnected
                      ? `Page connected${facebookPageName ? `: ${facebookPageName}` : ""}. Publish/schedule from Social.`
                      : "App credentials present — connect a Page from Social Posting.",
            },
            {
                id: "carfax",
                name: "CARFAX",
                description:
                    "PDF upload, partner VHR link, or partner API fetch per vehicle.",
                configured: carfax.configured,
                status: carfax.status,
                missing: carfax.missing,
                notes: carfax.notes,
            },
            {
                id: "kijiji_syndication",
                name: "Kijiji listing pack",
                description:
                    "Copy/export Kijiji-ready text, JSON, or CSV from vehicle VDP.",
                configured: true,
                status: "url_only",
                missing: [],
                href: "/inventory",
                notes:
                    "Honest MVP — no Kijiji API credentials. Open a vehicle VDP → Marketplace syndication.",
            },
            {
                id: "autotrader_syndication",
                name: "AutoTrader Canada feed",
                description:
                    "Pipe-delimited / CSV inventory feed for AT.ca partner upload (download only).",
                configured: true,
                status: autotraderCompanySet ? "partial" : "url_only",
                missing: autotraderCompanySet
                    ? []
                    : ["Business → AutoTrader Company ID"],
                href: autotraderCompanySet
                    ? "/inventory"
                    : "/settings/business",
                notes: autotraderLastExport
                    ? `Export/feed ready. Last export ${autotraderLastExport}. Not auto-listed — upload via your AT/HomeNet process.${
                          autotraderCompanySet
                              ? ""
                              : " Set AutoTrader Company ID under Settings → Business when you have a partner ID."
                      }`
                    : `VDP or Inventory → AutoTrader pipe feed / CSV. Batch: Active stock via Inventory “AT.ca feed”.${
                          autotraderCompanySet
                              ? ""
                              : " Optional: set AutoTrader Company ID under Settings → Business."
                      }`,
            },
        ];

        return NextResponse.json({
            data: {
                dealership_id: dealershipId,
                integrations,
                email_from_set: Boolean(process.env.EMAIL_FROM),
                email_from: resolvedEmailFrom
                    ? {
                          from: resolvedEmailFrom.from,
                          source: resolvedEmailFrom.source,
                          display_name: resolvedEmailFrom.displayName ?? null,
                          dealer_override:
                              resolvedEmailFrom.source === "dealer",
                          email_from_set: Boolean(process.env.EMAIL_FROM),
                      }
                    : null,
                sms: {
                    configured: twilioOk,
                    missing: missingTwilio,
                    from_number: smsFromNumber,
                    quiet_hours_enabled: quietHoursEnabled,
                },
                webhooks: {
                    count: webhookCount,
                },
                api_tokens: {
                    count: apiTokenCount,
                },
                secrets_present: {
                    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
                    EMAIL_FROM: Boolean(process.env.EMAIL_FROM),
                    FACEBOOK_APP_ID: Boolean(process.env.FACEBOOK_APP_ID),
                    FACEBOOK_APP_SECRET: Boolean(
                        process.env.FACEBOOK_APP_SECRET
                    ),
                    FACEBOOK_REDIRECT_URI: Boolean(
                        process.env.FACEBOOK_REDIRECT_URI
                    ),
                    SOCIAL_CRON_SECRET: Boolean(
                        process.env.SOCIAL_CRON_SECRET
                    ),
                    CARFAX_PARTNER_ID: Boolean(process.env.CARFAX_PARTNER_ID),
                    CARFAX_API_KEY: Boolean(process.env.CARFAX_API_KEY),
                    CARFAX_API_URL: Boolean(process.env.CARFAX_API_URL),
                    FLASH_AI_SECRET: Boolean(process.env.MINIMAX_API_KEY),
                    TWILIO_ACCOUNT_SID: Boolean(
                        process.env.TWILIO_ACCOUNT_SID
                    ),
                    TWILIO_AUTH_TOKEN: Boolean(
                        process.env.TWILIO_AUTH_TOKEN
                    ),
                    TWILIO_FROM_NUMBER: Boolean(
                        process.env.TWILIO_FROM_NUMBER
                    ),
                },
            },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching integration status:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}
