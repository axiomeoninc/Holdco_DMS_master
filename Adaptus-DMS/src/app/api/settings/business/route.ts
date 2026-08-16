// Dealership self-service business profile (not platform-admin-only).
import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    requireWriteDealershipId,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

type DealershipSettings = Record<string, unknown>;

const BARE_EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+$/;
const FORMATTED_EMAIL_RE = /<[^<>@\s]+@[^<>@\s]+>/;
const MAX_DISPLAY_NAME_LENGTH = 120;

/**
 * Empty clears the override; otherwise accept a bare address or an RFC 5322
 * "Name <address>" string.
 */
function isValidEmailFrom(value: string): boolean {
    const v = value.trim();
    if (!v) return true;
    return BARE_EMAIL_RE.test(v) || FORMATTED_EMAIL_RE.test(v);
}

function asSettings(raw: unknown): DealershipSettings {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return raw as DealershipSettings;
    }
    return {};
}

function canManageSettings(profile: {
    role?: string | null;
    is_platform_admin?: boolean | null;
    user_permissions?: string[] | null;
}): boolean {
    if (profile.is_platform_admin) return true;
    if (profile.role === "Admin" || profile.role === "Manager") return true;
    const perms = profile.user_permissions || [];
    if (perms.includes("*")) return true;
    return (
        perms.includes("settings:write") ||
        perms.includes("settings:company") ||
        perms.includes("settings:taxes")
    );
}

function canReadSettings(profile: {
    role?: string | null;
    is_platform_admin?: boolean | null;
    user_permissions?: string[] | null;
}): boolean {
    if (canManageSettings(profile)) return true;
    if (profile.role === "Salesperson" || profile.role === "Staff") return true;
    const perms = profile.user_permissions || [];
    return perms.includes("settings:read") || perms.includes("*");
}

const SELECT_COLS =
    "id, name, slug, business_name, business_address, business_phone, business_email, settings, status";

function shapeBusinessResponse(
    data: {
        id: string;
        name: string;
        slug: string | null;
        business_name: string | null;
        business_address: string | null;
        business_phone: string | null;
        business_email: string | null;
        status: string;
        settings: unknown;
    },
    canEdit: boolean
) {
    const settings = asSettings(data.settings);
    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        business_name: data.business_name,
        business_address: data.business_address,
        business_phone: data.business_phone,
        business_email: data.business_email,
        status: data.status,
        hst_number:
            typeof settings.hst_number === "string" ? settings.hst_number : "",
        dealer_license:
            typeof settings.dealer_license === "string"
                ? settings.dealer_license
                : typeof settings.license_number === "string"
                  ? settings.license_number
                  : "",
        autotrader_company_id:
            typeof settings.autotrader_company_id === "string"
                ? settings.autotrader_company_id
                : "",
        autotrader_category_id:
            typeof settings.autotrader_category_id === "string"
                ? settings.autotrader_category_id
                : "",
        email_from:
            typeof settings.email_from === "string" ? settings.email_from : "",
        display_name:
            typeof settings.display_name === "string" ? settings.display_name : "",
        settings,
        can_edit: canEdit,
    };
}

export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;

        if (!canReadSettings(auth.profile)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const dealershipId = requireWriteDealershipId(
            tenantScopeFromRequest(tenant, req)
        );

        // Service role, scoped to caller's dealership_id — RLS on dealerships
        // blocks Salesperson/Staff JWT reads even for their own row.
        const { data, error } = await supabase
            .from("dealerships")
            .select(SELECT_COLS)
            .eq("id", dealershipId)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: "Dealership not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            data: shapeBusinessResponse(
                data,
                canManageSettings(auth.profile)
            ),
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching business settings:", error);
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

export async function PATCH(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase } = tenant;

        if (!canManageSettings(auth.profile)) {
            return NextResponse.json(
                {
                    error: "Forbidden — settings:write or Admin/Manager required",
                },
                { status: 403 }
            );
        }

        const dealershipId = requireWriteDealershipId(
            tenantScopeFromRequest(tenant, req)
        );

        const body = (await req.json()) as Record<string, unknown>;

        const { data: existing, error: existingError } = await supabase
            .from("dealerships")
            .select(SELECT_COLS)
            .eq("id", dealershipId)
            .single();

        if (existingError || !existing) {
            return NextResponse.json(
                { error: "Dealership not found" },
                { status: 404 }
            );
        }

        const nextSettings = { ...asSettings(existing.settings) };
        if (typeof body.hst_number === "string") {
            nextSettings.hst_number = body.hst_number.trim();
        }
        if (typeof body.dealer_license === "string") {
            nextSettings.dealer_license = body.dealer_license.trim();
            nextSettings.license_number = body.dealer_license.trim();
        }
        if (typeof body.autotrader_company_id === "string") {
            nextSettings.autotrader_company_id =
                body.autotrader_company_id.trim();
        }
        if (typeof body.autotrader_category_id === "string") {
            nextSettings.autotrader_category_id =
                body.autotrader_category_id.trim();
        }

        // Email from-address override (Settings → Business → Email).
        // Empty clears the override (falls back to EMAIL_FROM env / default).
        if (body.email_from !== undefined) {
            if (
                typeof body.email_from !== "string" ||
                !isValidEmailFrom(body.email_from)
            ) {
                return NextResponse.json(
                    {
                        error:
                            'email_from must be empty, a valid email, or a "Name <email>" string',
                    },
                    { status: 400 }
                );
            }
            nextSettings.email_from = body.email_from.trim();
        }
        if (body.display_name !== undefined) {
            if (typeof body.display_name !== "string") {
                return NextResponse.json(
                    { error: "display_name must be a string" },
                    { status: 400 }
                );
            }
            const displayName = body.display_name.trim();
            if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
                return NextResponse.json(
                    {
                        error: `display_name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer`,
                    },
                    { status: 400 }
                );
            }
            nextSettings.display_name = displayName;
        }

        const updatePayload: Record<string, unknown> = {
            settings: nextSettings,
        };

        if (typeof body.name === "string" && body.name.trim()) {
            updatePayload.name = body.name.trim();
        }
        if (typeof body.business_name === "string") {
            updatePayload.business_name = body.business_name.trim() || null;
        }
        if (typeof body.business_address === "string") {
            updatePayload.business_address =
                body.business_address.trim() || null;
        }
        if (typeof body.business_phone === "string") {
            updatePayload.business_phone = body.business_phone.trim() || null;
        }
        if (typeof body.business_email === "string") {
            updatePayload.business_email = body.business_email.trim() || null;
        }

        const { data, error } = await supabase
            .from("dealerships")
            .update(updatePayload)
            .eq("id", dealershipId)
            .select(SELECT_COLS)
            .single();

        if (error || !data) {
            throw error || new Error("Update failed");
        }

        return NextResponse.json({
            data: shapeBusinessResponse(data, true),
        });
    } catch (error: unknown) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return NextResponse.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error updating business settings:", error);
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
