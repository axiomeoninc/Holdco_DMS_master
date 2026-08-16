import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";
import { quietHoursLabel } from "@/src/lib/sms/quiet-hours";

/**
 * SMS settings (Settings → Integrations).
 * Currently supports toggling the dealership quiet-hours window, stored in
 * dealerships.settings.sms_quiet_hours. Provider credentials stay in env.
 */
export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;
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
        const { data: dealer, error } = await supabase
            .from("dealerships")
            .select("settings")
            .eq("id", rooftop)
            .maybeSingle();
        if (error) throw error;

        const settings = {
            ...((dealer?.settings || {}) as Record<string, unknown>),
        };
        const existing =
            typeof settings.sms_quiet_hours === "object" &&
            settings.sms_quiet_hours !== null
                ? (settings.sms_quiet_hours as Record<string, unknown>)
                : {};

        if (typeof body.quiet_hours_enabled === "boolean") {
            settings.sms_quiet_hours = {
                ...existing,
                enabled: body.quiet_hours_enabled,
                start:
                    typeof body.quiet_hours_start === "string"
                        ? body.quiet_hours_start
                        : existing.start ?? "21:00",
                end:
                    typeof body.quiet_hours_end === "string"
                        ? body.quiet_hours_end
                        : existing.end ?? "09:00",
                timezone:
                    typeof body.quiet_hours_timezone === "string"
                        ? body.quiet_hours_timezone
                        : existing.timezone ?? "America/Toronto",
            };
        }

        const { error: updateErr } = await supabase
            .from("dealerships")
            .update({ settings })
            .eq("id", rooftop);
        if (updateErr) throw updateErr;

        const qh = settings.sms_quiet_hours as Record<string, unknown> | undefined;
        return NextResponse.json({
            data: {
                quiet_hours_enabled: qh?.enabled === true,
                quiet_hours_label: quietHoursLabel({
                    enabled: qh?.enabled === true,
                    start: typeof qh?.start === "string" ? qh.start : undefined,
                    end: typeof qh?.end === "string" ? qh.end : undefined,
                    timezone:
                        typeof qh?.timezone === "string" ? qh.timezone : undefined,
                }),
            },
            message: "SMS settings saved.",
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("SMS settings error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
