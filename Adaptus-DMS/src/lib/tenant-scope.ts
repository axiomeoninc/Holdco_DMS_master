import {
    nonEmptyDealershipId,
    readExplicitDealershipId,
    type RooftopRequest,
} from "./platform-rooftop";

/**
 * Fail-closed dealership scoping for service-role CRUD.
 *
 * Dealers must have a dealership_id or the helper throws (never unscoped SELECT).
 * Platform admins may pass an explicit rooftop (`platformDealershipId` / `?dealership_id=`).
 * Without a rooftop, only platform tables and the AdaptUs users console stay unscoped.
 * CRM lists without a rooftop filter to an empty sentinel so mixed tenant rows never leak.
 * Never `.eq("dealership_id", "")`.
 */

/** UUID that matches no rooftop — empty result set, not a mixed dump. */
export const EMPTY_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export const PLATFORM_UNSCOPED_TABLES = new Set([
    "dealerships",
    "audit_logs",
    "feature_flags",
]);

/** AdaptUs All Users console is the only CRM-ish table allowed unscoped for platform. */
export const PLATFORM_GLOBAL_LIST_TABLES = new Set(["users"]);

export type TenantScopeOpts = {
    dealershipId: string | null | undefined;
    isPlatformAdmin: boolean;
    /** Explicit rooftop from `?dealership_id=` (platform only). */
    platformDealershipId?: string | null;
};

export class TenantScopeError extends Error {
    status: number;
    constructor(message: string, status = 403) {
        super(message);
        this.name = "TenantScopeError";
        this.status = status;
    }
}

export function isTenantScopeError(error: unknown): error is TenantScopeError {
    return error instanceof TenantScopeError;
}

export function tenantScopeHttpError(
    error: unknown
): { error: string; status: number } | null {
    if (error instanceof TenantScopeError) {
        return { error: error.message, status: error.status };
    }
    return null;
}

export function tenantScopeFromProfile(
    profile: { dealership_id: string | null },
    isPlatformAdmin: boolean,
    platformDealershipId?: string | null
): TenantScopeOpts {
    return {
        dealershipId: profile.dealership_id,
        isPlatformAdmin,
        platformDealershipId: isPlatformAdmin
            ? nonEmptyDealershipId(platformDealershipId) || undefined
            : undefined,
    };
}

export function tenantScopeFromRequest(
    tenant: {
        isPlatformAdmin: boolean;
        auth: {
            profile: { dealership_id: string | null };
            dealership_id?: string | null;
        };
    },
    req: RooftopRequest
): TenantScopeOpts {
    const bound = nonEmptyDealershipId(tenant.auth.dealership_id);
    const requested = readExplicitDealershipId(req);
    return tenantScopeFromProfile(
        tenant.auth.profile,
        tenant.isPlatformAdmin,
        bound || requested
    );
}

/**
 * Rooftop id for `.eq("dealership_id")`, or `null` to leave the query unscoped.
 * Throws if a non-platform user has no dealership_id.
 */
export function resolveTenantDealershipId(
    opts: TenantScopeOpts,
    table?: string
): string | null {
    if (!opts.isPlatformAdmin) {
        const home = nonEmptyDealershipId(opts.dealershipId);
        if (!home) {
            throw new TenantScopeError("No dealership context", 403);
        }
        return home;
    }

    // AdaptUs console tables stay global even when an Act-as rooftop is bound.
    if (
        table &&
        (PLATFORM_UNSCOPED_TABLES.has(table) ||
            PLATFORM_GLOBAL_LIST_TABLES.has(table))
    ) {
        return null;
    }

    const rooftop = nonEmptyDealershipId(opts.platformDealershipId);
    if (rooftop) {
        return rooftop;
    }

    // Platform CRM dump without an explicit rooftop: empty, never mixed tenants.
    if (table) {
        return EMPTY_TENANT_ID;
    }

    return null;
}

/** Writes always stamp a real rooftop. Platform without one → 400. */
export function requireWriteDealershipId(opts: TenantScopeOpts): string {
    if (!opts.isPlatformAdmin) {
        const home = nonEmptyDealershipId(opts.dealershipId);
        if (!home) {
            throw new TenantScopeError("No dealership context", 403);
        }
        return home;
    }
    const rooftop =
        nonEmptyDealershipId(opts.platformDealershipId) ||
        nonEmptyDealershipId(opts.dealershipId);
    if (!rooftop) {
        throw new TenantScopeError("Dealership required", 400);
    }
    return rooftop;
}

export function stampDealershipId<T extends Record<string, unknown>>(
    row: T,
    opts: TenantScopeOpts
): T & { dealership_id: string } {
    return { ...row, dealership_id: requireWriteDealershipId(opts) };
}

export function applyTenantScope<T>(
    query: T,
    opts: TenantScopeOpts,
    table?: string
): T {
    const rooftop = resolveTenantDealershipId(opts, table);
    if (rooftop === null) {
        return query;
    }
    return (query as { eq: (column: string, value: string) => T }).eq(
        "dealership_id",
        rooftop
    );
}

/**
 * Applies tenant `.eq` after `.select`. PostgREST QueryBuilders have no
 * `.eq` until a filter builder exists; test mocks that already expose `.eq`
 * are scoped immediately.
 */
export function scopedTable<TFrom>(
    supabase: { from: (table: string) => TFrom },
    table: string,
    opts: TenantScopeOpts
): TFrom {
    const builder = supabase.from(table);
    const selectable = builder as TFrom & {
        select?: (...args: never[]) => unknown;
    };
    if (typeof selectable.select === "function") {
        const originalSelect = selectable.select.bind(builder);
        (selectable as { select: (...args: never[]) => unknown }).select = (
            ...args: never[]
        ) => applyTenantScope(originalSelect(...args), opts, table);
        return selectable;
    }
    return applyTenantScope(builder, opts, table);
}

export { nonEmptyDealershipId };
