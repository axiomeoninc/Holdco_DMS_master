import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { revokeApiToken } from "@/src/lib/api/tokens";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
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
        const { id } = await params;
        const result = await revokeApiToken(rooftop, id);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ data: { id }, message: "API token revoked." });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("API token revoke error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
