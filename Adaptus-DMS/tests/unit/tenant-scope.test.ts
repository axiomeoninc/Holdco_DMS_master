import { describe, expect, it } from "vitest";
import {
  applyTenantScope,
  EMPTY_TENANT_ID,
  requireWriteDealershipId,
  resolveTenantDealershipId,
  scopedTable,
  stampDealershipId,
  TenantScopeError,
  tenantScopeFromRequest,
} from "@/src/lib/tenant-scope";

const DEALER_A = "dealership-a";
const DEALER_B = "dealership-b";

function trackingClient() {
  const calls: Array<{ table: string; eqs: Array<[string, string]> }> = [];
  const from = (table: string) => {
    const eqs: Array<[string, string]> = [];
    const q = {
      eq(column: string, value: string) {
        eqs.push([column, value]);
        return q;
      },
      snapshot() {
        calls.push({ table, eqs: [...eqs] });
        return { table, eqs: [...eqs] };
      },
    };
    return q;
  };
  return { from, calls };
}

describe("resolveTenantDealershipId", () => {
  it("throws when a dealer has no dealership_id", () => {
    expect(() =>
      resolveTenantDealershipId({
        dealershipId: null,
        isPlatformAdmin: false,
      })
    ).toThrow(TenantScopeError);
  });

  it("always returns the dealer rooftop — never another dealer", () => {
    expect(
      resolveTenantDealershipId({
        dealershipId: DEALER_A,
        isPlatformAdmin: false,
        platformDealershipId: DEALER_B,
      })
    ).toBe(DEALER_A);
  });

  it("scopes platform to an explicit rooftop", () => {
    expect(
      resolveTenantDealershipId(
        {
          dealershipId: null,
          isPlatformAdmin: true,
          platformDealershipId: DEALER_B,
        },
        "customers"
      )
    ).toBe(DEALER_B);
  });

  it("allows platform users list without rooftop (AdaptUs All Users)", () => {
    expect(
      resolveTenantDealershipId(
        { dealershipId: null, isPlatformAdmin: true },
        "users"
      )
    ).toBeNull();
  });

  it("does not dump mixed CRM rows for platform without rooftop", () => {
    expect(
      resolveTenantDealershipId(
        { dealershipId: null, isPlatformAdmin: true },
        "customers"
      )
    ).toBe(EMPTY_TENANT_ID);
    expect(
      resolveTenantDealershipId(
        { dealershipId: null, isPlatformAdmin: true },
        "roles"
      )
    ).toBe(EMPTY_TENANT_ID);
    expect(
      resolveTenantDealershipId(
        { dealershipId: null, isPlatformAdmin: true },
        "user_roles"
      )
    ).toBe(EMPTY_TENANT_ID);
  });
});

describe("scopedTable / applyTenantScope", () => {
  it("dealer queries cannot match dealer B", () => {
    const supabase = trackingClient();
    const q = scopedTable(supabase, "users", {
      dealershipId: DEALER_A,
      isPlatformAdmin: false,
    });
    const seen = q.snapshot();
    expect(seen.eqs).toContainEqual(["dealership_id", DEALER_A]);
    expect(seen.eqs.some(([, v]) => v === DEALER_B)).toBe(false);
  });

  it("platform with rooftop filters that rooftop on CRM tables", () => {
    const query = {
      eqs: [] as Array<[string, string]>,
      eq(column: string, value: string) {
        this.eqs.push([column, value]);
        return this;
      },
    };
    applyTenantScope(
      query,
      {
        dealershipId: null,
        isPlatformAdmin: true,
        platformDealershipId: DEALER_B,
      },
      "customers"
    );
    expect(query.eqs).toEqual([["dealership_id", DEALER_B]]);
  });
});

describe("requireWriteDealershipId / stampDealershipId", () => {
  it("stamps the session rooftop for dealers", () => {
    const row = stampDealershipId(
      { name: "Ada" },
      { dealershipId: DEALER_A, isPlatformAdmin: false }
    );
    expect(row.dealership_id).toBe(DEALER_A);
  });

  it("rejects dealer writes without a rooftop", () => {
    expect(() =>
      requireWriteDealershipId({
        dealershipId: null,
        isPlatformAdmin: false,
      })
    ).toThrow(/No dealership context/);
  });

  it("rejects platform writes without an explicit rooftop", () => {
    expect(() =>
      requireWriteDealershipId({
        dealershipId: null,
        isPlatformAdmin: true,
      })
    ).toThrow(/Dealership required/);
  });
});

describe("tenantScopeFromRequest", () => {
  it("ignores a spoofed dealership_id query param for dealers", () => {
    const scope = tenantScopeFromRequest(
      {
        isPlatformAdmin: false,
        auth: { profile: { dealership_id: DEALER_A } },
      },
      { url: `http://localhost/api/users?dealership_id=${DEALER_B}` }
    );
    expect(scope.platformDealershipId).toBeUndefined();
    expect(resolveTenantDealershipId(scope, "users")).toBe(DEALER_A);
  });

  it("honors dealership_id query param for platform CRM", () => {
    const scope = tenantScopeFromRequest(
      {
        isPlatformAdmin: true,
        auth: { profile: { dealership_id: null } },
      },
      { url: `http://localhost/api/customers?dealership_id=${DEALER_B}` }
    );
    expect(resolveTenantDealershipId(scope, "customers")).toBe(DEALER_B);
  });

  it("keeps AdaptUs All Users global even with a rooftop picker", () => {
    const scope = tenantScopeFromRequest(
      {
        isPlatformAdmin: true,
        auth: { profile: { dealership_id: null }, dealership_id: DEALER_B },
      },
      { url: `http://localhost/api/users?dealership_id=${DEALER_B}` }
    );
    expect(resolveTenantDealershipId(scope, "users")).toBeNull();
  });

  it("honors X-Dealership-Id and cookie for platform", () => {
    const fromHeader = tenantScopeFromRequest(
      {
        isPlatformAdmin: true,
        auth: { profile: { dealership_id: null } },
      },
      {
        url: "http://localhost/api/vehicles",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "x-dealership-id" ? DEALER_B : null,
        },
      }
    );
    expect(resolveTenantDealershipId(fromHeader, "vehicles")).toBe(DEALER_B);

    const fromCookie = tenantScopeFromRequest(
      {
        isPlatformAdmin: true,
        auth: { profile: { dealership_id: null } },
      },
      {
        url: "http://localhost/api/vehicles",
        cookies: {
          get: (name: string) =>
            name === "dealership_id" ? { value: DEALER_B } : undefined,
        },
      }
    );
    expect(resolveTenantDealershipId(fromCookie, "vehicles")).toBe(DEALER_B);
  });

  it("uses bound auth.dealership_id over query for platform", () => {
    const scope = tenantScopeFromRequest(
      {
        isPlatformAdmin: true,
        auth: { profile: { dealership_id: null }, dealership_id: DEALER_A },
      },
      { url: `http://localhost/api/vehicles?dealership_id=${DEALER_B}` }
    );
    expect(resolveTenantDealershipId(scope, "vehicles")).toBe(DEALER_A);
  });
});

describe("empty rooftop is never a filter", () => {
  it("treats platformDealershipId '' as unbound CRM sentinel", () => {
    const query = {
      eqs: [] as Array<[string, string]>,
      eq(column: string, value: string) {
        this.eqs.push([column, value]);
        return this;
      },
    };
    applyTenantScope(
      query,
      {
        dealershipId: null,
        isPlatformAdmin: true,
        platformDealershipId: "",
      },
      "vehicles"
    );
    expect(query.eqs).toEqual([["dealership_id", EMPTY_TENANT_ID]]);
    expect(query.eqs.some(([, v]) => v === "")).toBe(false);
  });
});
