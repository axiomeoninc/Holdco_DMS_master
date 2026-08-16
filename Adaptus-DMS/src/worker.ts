// src/worker.ts
// Cloudflare Workers entry that wraps the OpenNext-generated worker and adds
// security headers to every response. OpenNext on Cloudflare does not apply
// next.config.ts headers() — see
// https://github.com/opennextjs/opennextjs-cloudflare/issues/107
//
// This file is referenced from wrangler.toml as `main`. It imports the
// OpenNext-generated handler from .open-next/worker.js.
//
// Headers are imported from `src/lib/security-headers.ts` so this file
// and next.config.ts cannot drift (P1-4 dedupe).
//
// Social v1: optional scheduled handler publishes due Facebook Page drafts
// when SOCIAL_CRON_SECRET is set (see /api/social/publish-scheduled).
// CRM email: same hourly cron also hits /api/email-sequences/send-due
// (CRM_CRON_SECRET or SOCIAL_CRON_SECRET; Resend must be configured).
// SMS: same hourly cron hits /api/sms/sequences/send-due (Twilio).

import {
    isPubliclyFrameablePath,
    securityHeadersMapForPath,
} from "./lib/security-headers";

interface OpenNextWorkerModule {
    default: {
        fetch: (request: Request, env: Record<string, unknown>, ctx: WorkerContext) => Promise<Response>;
    };
}

interface WorkerContext {
    waitUntil: (promise: Promise<unknown>) => void;
}

const openNextWorkerPromise: Promise<OpenNextWorkerModule> = import("../.open-next/worker.js");

function applySecurityHeaders(request: Request, response: Response): Response {
    const pathname = new URL(request.url).pathname;
    const headers = securityHeadersMapForPath(pathname);
    for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
    }
    if (isPubliclyFrameablePath(pathname)) {
        response.headers.delete("X-Frame-Options");
    }
    return response;
}

export default {
    async fetch(request: Request, env: Record<string, unknown>, ctx: WorkerContext): Promise<Response> {
        const mod = await openNextWorkerPromise;
        const response = await mod.default.fetch(request, env, ctx);
        return applySecurityHeaders(request, response);
    },

    /**
     * Hourly cron (wrangler [triggers] crons).
     * Social: publish-scheduled when SOCIAL_CRON_SECRET set.
     * CRM: send-due sequences when CRM_CRON_SECRET or SOCIAL_CRON_SECRET set + Resend.
     */
    async scheduled(_controller: { scheduledTime: number; cron: string }, env: Record<string, unknown>, ctx: WorkerContext): Promise<void> {
        const socialSecret = (env?.SOCIAL_CRON_SECRET as string | undefined)?.trim();
        const crmSecret =
            (env?.CRM_CRON_SECRET as string | undefined)?.trim() || socialSecret;

        const origin =
            (env?.SOCIAL_PUBLIC_ORIGIN as string | undefined)?.trim() ||
            (env?.APP_URL as string | undefined)?.trim() ||
            "https://dms.adaptusgroup.ca";

        if (socialSecret) {
            ctx.waitUntil(
                (async () => {
                    try {
                        const mod = await openNextWorkerPromise;
                        const req = new Request(`${origin}/api/social/publish-scheduled`, {
                            method: "POST",
                            headers: {
                                "x-social-cron-secret": socialSecret,
                                "content-type": "application/json",
                            },
                        });
                        const res = await mod.default.fetch(req, env, ctx);
                        const text = await res.text();
                        console.log("[social-cron]", res.status, text.slice(0, 500));
                    } catch (err) {
                        console.error("[social-cron] failed:", err);
                    }
                })()
            );
        } else {
            console.log(
                "[social-cron] skipped — SOCIAL_CRON_SECRET not set; scheduled_date posts await manual publish or future secret"
            );
        }

        if (crmSecret) {
            ctx.waitUntil(
                (async () => {
                    try {
                        const mod = await openNextWorkerPromise;
                        const req = new Request(`${origin}/api/email-sequences/send-due`, {
                            method: "POST",
                            headers: {
                                "x-crm-cron-secret": crmSecret,
                                "x-social-cron-secret": crmSecret,
                                "content-type": "application/json",
                            },
                        });
                        const res = await mod.default.fetch(req, env, ctx);
                        const text = await res.text();
                        console.log("[crm-email-cron]", res.status, text.slice(0, 500));
                    } catch (err) {
                        console.error("[crm-email-cron] failed:", err);
                    }
                })()
            );
        } else {
            console.log(
                "[crm-email-cron] skipped — CRM_CRON_SECRET/SOCIAL_CRON_SECRET unset; use Send next or set secrets"
            );
        }

        // SMS: same hourly cron fires /api/sms/sequences/send-due (Twilio).
        // Uses the same CRM_CRON_SECRET / SOCIAL_CRON_SECRET auth; degrades
        // cleanly when Twilio secrets are absent (no fake sends).
        if (crmSecret) {
            ctx.waitUntil(
                (async () => {
                    try {
                        const mod = await openNextWorkerPromise;
                        const req = new Request(`${origin}/api/sms/sequences/send-due`, {
                            method: "POST",
                            headers: {
                                "x-crm-cron-secret": crmSecret,
                                "x-social-cron-secret": crmSecret,
                                "content-type": "application/json",
                            },
                        });
                        const res = await mod.default.fetch(req, env, ctx);
                        const text = await res.text();
                        console.log("[crm-sms-cron]", res.status, text.slice(0, 500));
                    } catch (err) {
                        console.error("[crm-sms-cron] failed:", err);
                    }
                })()
            );
        } else {
            console.log(
                "[crm-sms-cron] skipped — CRM_CRON_SECRET/SOCIAL_CRON_SECRET unset; due SMS enrollments stay queued"
            );
        }
    },
};
