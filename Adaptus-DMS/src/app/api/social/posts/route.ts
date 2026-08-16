import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { logSocialAudit } from "@/src/lib/social/audit";
import { publishPagePost } from "@/src/lib/social/facebook";

const PLATFORMS = ["Facebook", "Instagram", "Twitter", "LinkedIn"] as const;
const STATUSES = ["Draft", "Scheduled", "Published", "Failed"] as const;

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.is_platform_admin
            ? new URL(req.url).searchParams.get("dealership_id") || auth.profile.dealership_id
            : auth.profile.dealership_id;

        if (!dealershipId) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const url = new URL(req.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const status = url.searchParams.get("status");
        const platform = url.searchParams.get("platform");

        let query = supabaseAdmin
            .from("social_media_posts")
            .select("*", { count: "exact" })
            .eq("dealership_id", dealershipId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq("status", status);
        if (platform) query = query.eq("platform", platform);

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({ data: data || [], count: count || 0, limit, offset });
    } catch (error: unknown) {
        console.error("Error fetching social posts:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const body = await req.json();
        const targetDealership =
            auth.profile.is_platform_admin && body.dealership_id
                ? body.dealership_id
                : dealershipId;

        if (!targetDealership) {
            return NextResponse.json({ error: "dealership_id required" }, { status: 400 });
        }

        if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const platform = body.platform || "Facebook";
        if (!PLATFORMS.includes(platform)) {
            return NextResponse.json(
                { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
                { status: 400 }
            );
        }

        let status = body.status || "Draft";
        if (!STATUSES.includes(status)) {
            return NextResponse.json(
                { error: `status must be one of: ${STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

        const publishNow = Boolean(body.publish_now);
        const scheduledDate =
            typeof body.scheduled_date === "string" && body.scheduled_date
                ? body.scheduled_date
                : null;

        // Honesty: never persist Published without a real Graph post_id.
        // Clients may send status=Published; ignore until publish succeeds.
        if (status === "Published" && !publishNow) {
            status = scheduledDate ? "Scheduled" : "Draft";
        }

        let publishedDate: string | null = null;
        let notes = body.notes ? String(body.notes) : null;
        let graphPostId: string | null = null;
        let honestyMessage: string | null = null;

        // Resolve media from vehicle gallery when vehicle_id given and media not supplied
        let mediaUrls: string[] | null = Array.isArray(body.media_urls)
            ? (body.media_urls as string[]).filter(Boolean)
            : null;

        const vehicleId = body.vehicle_id || null;
        if (vehicleId && (!mediaUrls || mediaUrls.length === 0)) {
            const { data: vehicle } = await supabaseAdmin
                .from("vehicles")
                .select("id, image_gallery, dealership_id")
                .eq("id", vehicleId)
                .maybeSingle();
            if (
                vehicle &&
                (!vehicle.dealership_id ||
                    vehicle.dealership_id === targetDealership ||
                    auth.profile.is_platform_admin)
            ) {
                const gallery = Array.isArray(vehicle.image_gallery)
                    ? vehicle.image_gallery.filter(
                          (u: unknown): u is string =>
                              typeof u === "string" && u.startsWith("http")
                      )
                    : [];
                mediaUrls = gallery.slice(0, 4);
            }
        }

        if (vehicleId) {
            notes = [notes, `vehicle_id=${vehicleId}`].filter(Boolean).join("\n");
        }

        if (scheduledDate && !publishNow) {
            status = "Scheduled";
            notes = [
                notes,
                "Scheduled for publish via cron or manual publish-scheduled. " +
                    "Set SOCIAL_CRON_SECRET + wrangler triggers for automatic Graph publish.",
            ]
                .filter(Boolean)
                .join("\n");
        }

        if (publishNow) {
            if (platform !== "Facebook") {
                status = "Draft";
                honestyMessage = `${platform} live publish not supported in Social v1 — saved as Draft.`;
                notes = [notes, honestyMessage].filter(Boolean).join("\n");
            } else {
                const { data: fb } = await supabaseAdmin
                    .from("facebook_business_account")
                    .select("id, page_id, is_active, access_token")
                    .eq("dealership_id", targetDealership)
                    .eq("is_active", true)
                    .maybeSingle();

                if (!fb?.access_token || !fb.page_id) {
                    status = "Draft";
                    honestyMessage =
                        "Facebook Page not connected — saved as Draft. Connect requires FACEBOOK_APP_ID/SECRET via wrangler, then Connect Page.";
                    notes = [notes, honestyMessage].filter(Boolean).join("\n");
                } else {
                    try {
                        const result = await publishPagePost({
                            pageId: fb.page_id,
                            pageAccessToken: fb.access_token,
                            message: String(body.content).trim(),
                            mediaUrls,
                        });
                        status = "Published";
                        publishedDate = new Date().toISOString();
                        graphPostId = result.post_id;
                        notes = [notes, `graph_post_id=${result.post_id}`, `graph_method=${result.method}`]
                            .filter(Boolean)
                            .join("\n");
                    } catch (pubErr) {
                        status = "Failed";
                        honestyMessage = `Publish failed: ${pubErr instanceof Error ? pubErr.message : "unknown"}`;
                        notes = [notes, honestyMessage].filter(Boolean).join("\n");
                    }
                }
            }
        }

        // Final guard: Published requires Graph id
        if (status === "Published" && !graphPostId) {
            status = "Draft";
            publishedDate = null;
            honestyMessage =
                honestyMessage ||
                "Refused fake Published status — no Graph post_id. Saved as Draft.";
            notes = [notes, honestyMessage].filter(Boolean).join("\n");
        }

        const insertRow: Record<string, unknown> = {
            platform,
            content: String(body.content).trim(),
            media_urls: mediaUrls,
            scheduled_date: scheduledDate,
            published_date: publishedDate,
            status,
            notes,
            dealership_id: targetDealership,
        };

        if (vehicleId) {
            insertRow.vehicle_id = vehicleId;
        }

        let { data, error } = await supabaseAdmin
            .from("social_media_posts")
            .insert(insertRow)
            .select()
            .single();

        if (error && vehicleId && /vehicle_id|column/i.test(error.message)) {
            delete insertRow.vehicle_id;
            const retry = await supabaseAdmin
                .from("social_media_posts")
                .insert(insertRow)
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) throw error;

        await logSocialAudit({
            action: `social.post.${status.toLowerCase()}`,
            entityType: "social_media_posts",
            entityId: data?.id,
            profile: auth.profile,
            dealershipId: targetDealership,
            metadata: {
                platform,
                status,
                publish_now: publishNow,
                scheduled_date: scheduledDate,
                graph_post_id: graphPostId,
                vehicle_id: vehicleId,
                media_count: mediaUrls?.length || 0,
            },
        });

        return NextResponse.json(
            {
                data,
                published: status === "Published" && Boolean(graphPostId),
                graph_post_id: graphPostId,
                message: honestyMessage,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Error creating social post:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
