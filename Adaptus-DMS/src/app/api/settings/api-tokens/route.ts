import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import {
    createApiToken,
    listApiTokens,
    API_SCOPES,
    type ApiScope,
} from "@/src/lib/api/tokens";

/**
 * API token management (Settings → Integrations).
 * GET lists tokens (no hashes); POST creates a token (shown once).
 */
export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const rooftop = requireWriteDealershipId(
            tenantScopeFromRequest(tenant, req)
        );
        const result = await listApiTokens(rooftop);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
            data: { tokens: result.tokens, scopes: API_SCOPES },
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("API tokens list error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth } = tenant;
        const isAdmin =
            auth.profile.is_platform_admin ||
            auth.profile.role === "Admin" ||
            auth.profile.role === "Manager";
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden - Admin or Manager required" },
                { status: 403 }
            );
        }

        const rooftop = requireWriteDealershipId(
            tenantScopeFromRequest(tenant, req)
        );

        const body = await req.json().catch(() => ({}));
        const name = typeof body.name === "string" ? body.name : "";
        const scopes: ApiScope[] = Array.isArray(body.scopes)
            ? body.scopes.filter((s: string) =>
                  (API_SCOPES as readonly string[]).includes(s)
              )
            : [];

        const result = await createApiToken({
            dealershipId: rooftop,
            name,
            scopes,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(
            {
                data: { token: result.token, record: result.record },
                message: "API token created. Copy it now — it is shown once.",
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("API token create error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
