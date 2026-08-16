/**
 * Meta Graph API helpers for Social v1 — Page OAuth + Page publish only.
 * No Marketplace bots. Tokens never returned to the client.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const OAUTH_SCOPES = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
].join(",");

export type FacebookEnvStatus = {
    oauth_ready: boolean;
    missing: string[];
    app_id: string | null;
};

export function getFacebookEnv(): FacebookEnvStatus {
    const appId = process.env.FACEBOOK_APP_ID?.trim() || null;
    const appSecret = process.env.FACEBOOK_APP_SECRET?.trim() || null;
    const missing: string[] = [];
    if (!appId) missing.push("FACEBOOK_APP_ID");
    if (!appSecret) missing.push("FACEBOOK_APP_SECRET");
    return {
        oauth_ready: missing.length === 0,
        missing,
        app_id: appId,
    };
}

export function getFacebookRedirectUri(reqUrl: string): string {
    const configured = process.env.FACEBOOK_REDIRECT_URI?.trim();
    if (configured) return configured;
    const origin = new URL(reqUrl).origin;
    return `${origin}/api/social/facebook/callback`;
}

function toBase64Url(input: string): string {
    return Buffer.from(input, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + pad, "base64").toString("utf8");
}

async function hmacSign(payload: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return Buffer.from(sig).toString("hex");
}

export async function buildOAuthState(opts: {
    dealershipId: string;
    userId: string;
}): Promise<string> {
    const secret = process.env.FACEBOOK_APP_SECRET!.trim();
    const payload = JSON.stringify({
        d: opts.dealershipId,
        u: opts.userId,
        t: Date.now(),
        n: crypto.randomUUID().slice(0, 8),
    });
    const body = toBase64Url(payload);
    const sig = await hmacSign(body, secret);
    return `${body}.${sig}`;
}

export async function parseOAuthState(
    state: string
): Promise<{ dealershipId: string; userId: string } | null> {
    const secret = process.env.FACEBOOK_APP_SECRET?.trim();
    if (!secret || !state.includes(".")) return null;
    const [body, sig] = state.split(".");
    if (!body || !sig) return null;
    const expected = await hmacSign(body, secret);
    if (expected !== sig) return null;
    try {
        const parsed = JSON.parse(fromBase64Url(body)) as {
            d?: string;
            u?: string;
            t?: number;
        };
        if (!parsed.d || !parsed.u || typeof parsed.t !== "number") return null;
        // 30-minute window
        if (Date.now() - parsed.t > 30 * 60 * 1000) return null;
        return { dealershipId: parsed.d, userId: parsed.u };
    } catch {
        return null;
    }
}

export function buildFacebookOAuthUrl(opts: {
    redirectUri: string;
    state: string;
}): string {
    const env = getFacebookEnv();
    if (!env.app_id) throw new Error("FACEBOOK_APP_ID is not configured");
    const params = new URLSearchParams({
        client_id: env.app_id,
        redirect_uri: opts.redirectUri,
        state: opts.state,
        scope: OAUTH_SCOPES,
        response_type: "code",
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

type GraphErrorBody = {
    error?: { message?: string; type?: string; code?: number };
};

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${GRAPH_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { method: "GET" });
    const json = (await res.json()) as T & GraphErrorBody;
    if (!res.ok || json.error) {
        throw new Error(json.error instanceof Error ? json.error.message : `Graph GET ${path} failed (${res.status})`);
    }
    return json;
}

async function graphPost<T>(
    path: string,
    body: Record<string, string>
): Promise<T> {
    const url = `${GRAPH_BASE}${path}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
    });
    const json = (await res.json()) as T & GraphErrorBody;
    if (!res.ok || json.error) {
        throw new Error(json.error instanceof Error ? json.error.message : `Graph POST ${path} failed (${res.status})`);
    }
    return json;
}

export async function exchangeCodeForUserToken(opts: {
    code: string;
    redirectUri: string;
}): Promise<string> {
    const env = getFacebookEnv();
    if (!env.app_id || !process.env.FACEBOOK_APP_SECRET) {
        throw new Error("Facebook app credentials missing");
    }
    const data = await graphGet<{ access_token: string }>("/oauth/access_token", {
        client_id: env.app_id,
        client_secret: process.env.FACEBOOK_APP_SECRET.trim(),
        redirect_uri: opts.redirectUri,
        code: opts.code,
    });
    return data.access_token;
}

export type FacebookPageAccount = {
    id: string;
    name: string;
    access_token: string;
};

export async function listManagedPages(userAccessToken: string): Promise<FacebookPageAccount[]> {
    const data = await graphGet<{ data?: FacebookPageAccount[] }>("/me/accounts", {
        fields: "id,name,access_token",
        access_token: userAccessToken,
    });
    return data.data || [];
}

export type PublishPagePostResult = {
    post_id: string;
    method: "feed" | "photo";
};

/**
 * Publish a Page post using existing public image URLs (dealer gallery).
 * Single image → /photos with caption; multi/no image → /feed (+ first image as link when useful).
 */
export async function publishPagePost(opts: {
    pageId: string;
    pageAccessToken: string;
    message: string;
    mediaUrls?: string[] | null;
}): Promise<PublishPagePostResult> {
    const urls = (opts.mediaUrls || []).filter((u) => typeof u === "string" && u.startsWith("http"));
    const message = opts.message.trim();

    if (urls.length === 1) {
        const photo = await graphPost<{ id: string; post_id?: string }>(`/${opts.pageId}/photos`, {
            url: urls[0]!,
            caption: message,
            published: "true",
            access_token: opts.pageAccessToken,
        });
        return {
            post_id: photo.post_id || photo.id,
            method: "photo",
        };
    }

    if (urls.length > 1) {
        const attached: string[] = [];
        for (const mediaUrl of urls.slice(0, 4)) {
            const unpublished = await graphPost<{ id: string }>(`/${opts.pageId}/photos`, {
                url: mediaUrl,
                published: "false",
                temporary: "true",
                access_token: opts.pageAccessToken,
            });
            attached.push(unpublished.id);
        }
        const body: Record<string, string> = {
            message,
            access_token: opts.pageAccessToken,
            published: "true",
        };
        attached.forEach((id, i) => {
            body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
        });
        const feed = await graphPost<{ id: string }>(`/${opts.pageId}/feed`, body);
        return { post_id: feed.id, method: "feed" };
    }

    const feed = await graphPost<{ id: string }>(`/${opts.pageId}/feed`, {
        message,
        access_token: opts.pageAccessToken,
        published: "true",
    });
    return { post_id: feed.id, method: "feed" };
}
