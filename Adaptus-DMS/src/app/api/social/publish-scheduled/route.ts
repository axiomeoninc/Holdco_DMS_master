import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { publishPagePost } from "@/src/lib/social/facebook";

/**
 * Publish due Scheduled Facebook posts (dealership-scoped Graph Page posts).
 *
 * Auth: Authorization: Bearer <SOCIAL_CRON_SECRET> or x-social-cron-secret header.
 * If SOCIAL_CRON_SECRET is unset, returns 503 with a clear message (manual publish still works).
 *
 * Cloudflare: wrangler [triggers] crons → worker scheduled → this route.
 * Without cron secret / triggers: schedule stores scheduled_at and awaits manual or future cron.
 */

function authorizeCron(req: NextRequest): boolean {
    const secret = process.env.SOCIAL_CRON_SECRET?.trim();
    if (!secret) return false;
    const header = req.headers.get("x-social-cron-secret");
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    return header === secret || bearer === secret;
}

export async function POST(req: NextRequest) {
    try {
        if (!process.env.SOCIAL_CRON_SECRET?.trim()) {
            return NextResponse.json(
                {
                    error: "SOCIAL_CRON_SECRET not configured",
                    message:
                        "Scheduled posts are stored with scheduled_date. " +
                        "Publish on schedule via manual POST here once secret is set, or future CF cron.",
                },
                { status: 503 }
            );
        }

        if (!authorizeCron(req)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
            .from("social_media_posts")
            .select("*")
            .eq("status", "Scheduled")
            .eq("platform", "Facebook")
            .lte("scheduled_date", nowIso)
            .order("scheduled_date", { ascending: true })
            .limit(25);

        if (error) throw error;

        const results: Array<{
            id: string;
            ok: boolean;
            status: string;
            error?: string;
            graph_post_id?: string;
        }> = [];

        for (const post of due || []) {
            if (!post.dealership_id) {
                results.push({ id: post.id, ok: false, status: "Failed", error: "missing dealership" });
                continue;
            }

            const { data: fb } = await supabaseAdmin
                .from("facebook_business_account")
                .select("page_id, access_token, is_active")
                .eq("dealership_id", post.dealership_id)
                .eq("is_active", true)
                .maybeSingle();

            if (!fb?.access_token || !fb.page_id) {
                const notes = [post.notes, "Cron: no Facebook Page token — left Scheduled."]
                    .filter(Boolean)
                    .join("\n");
                await supabaseAdmin
                    .from("social_media_posts")
                    .update({ notes, updated_at: nowIso })
                    .eq("id", post.id);
                results.push({
                    id: post.id,
                    ok: false,
                    status: "Scheduled",
                    error: "no page token",
                });
                continue;
            }

            try {
                const published = await publishPagePost({
                    pageId: fb.page_id,
                    pageAccessToken: fb.access_token,
                    message: post.content,
                    mediaUrls: post.media_urls,
                });
                const notes = [
                    post.notes,
                    `graph_post_id=${published.post_id}`,
                    `published_via=cron`,
                ]
                    .filter(Boolean)
                    .join("\n");
                await supabaseAdmin
                    .from("social_media_posts")
                    .update({
                        status: "Published",
                        published_date: nowIso,
                        notes,
                        updated_at: nowIso,
                    })
                    .eq("id", post.id);
                results.push({
                    id: post.id,
                    ok: true,
                    status: "Published",
                    graph_post_id: published.post_id,
                });
            } catch (pubErr) {
                const msg = pubErr instanceof Error ? pubErr.message : "publish failed";
                await supabaseAdmin
                    .from("social_media_posts")
                    .update({
                        status: "Failed",
                        notes: [post.notes, `Cron publish failed: ${msg}`].filter(Boolean).join("\n"),
                        updated_at: nowIso,
                    })
                    .eq("id", post.id);
                results.push({ id: post.id, ok: false, status: "Failed", error: msg });
            }
        }

        return NextResponse.json({
            data: {
                checked_at: nowIso,
                due_count: due?.length || 0,
                results,
            },
            message:
                "Processed due Scheduled Facebook posts. " +
                "Without wrangler cron + SOCIAL_CRON_SECRET, call this endpoint manually.",
        });
    } catch (error: unknown) {
        console.error("Error in publish-scheduled:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/** Allow GET for simple cron pingers with the same auth. */
export async function GET(req: NextRequest) {
    return POST(req);
}
