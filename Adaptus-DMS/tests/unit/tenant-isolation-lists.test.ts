import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const DEALER_A = "dealership-a";
const DEALER_B = "dealership-b";

const requireTenantClient = vi.fn();

vi.mock("@/src/lib/auth-helpers", async () => {
  const tenantScope = await import("@/src/lib/tenant-scope");
  return {
    requireTenantClient,
    pickAllowed: (payload: Record<string, unknown>, allowed: readonly string[]) => {
      const out: Record<string, unknown> = {};
      for (const k of allowed) {
        if (k in payload) out[k] = payload[k];
      }
      return out;
    },
    applyTenantScope: tenantScope.applyTenantScope,
    requireWriteDealershipId: tenantScope.requireWriteDealershipId,
    scopedTable: tenantScope.scopedTable,
    stampDealershipId: tenantScope.stampDealershipId,
    tenantScopeFromRequest: tenantScope.tenantScopeFromRequest,
    tenantScopeHttpError: tenantScope.tenantScopeHttpError,
    isTenantScopeError: tenantScope.isTenantScopeError,
    TenantScopeError: tenantScope.TenantScopeError,
  };
});

type Row = Record<string, unknown>;

function createClient(rowsByTable: Record<string, Row[]>) {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const q: Record<string, unknown> = {};
    const apply = (): { data: Row[]; count: number; error: null } => {
      let data = (rowsByTable[table] || []).slice();
      for (const [column, value] of filters) {
        data = data.filter((row) => row[column] === value);
      }
      return { data, count: data.length, error: null };
    };
    const chain = () => q;
    q.select = chain;
    q.eq = (column: string, value: unknown) => {
      filters.push([column, value]);
      return q;
    };
    q.gte = chain;
    q.gt = chain;
    q.lt = chain;
    q.lte = chain;
    q.not = chain;
    q.order = chain;
    q.range = chain;
    q.limit = chain;
    q.in = chain;
    q.or = chain;
    q.is = chain;
    q.ilike = chain;
    q.maybeSingle = async () => {
      const { data } = apply();
      return { data: data[0] ?? null, error: null };
    };
    q.single = async () => {
      const { data } = apply();
      return { data: data[0] ?? null, error: null };
    };
    q.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(apply()).then(resolve, reject);
    return q;
  };
  return { from };
}

vi.mock("@/src/lib/supabase-admin", () => {
  const pass: Record<string, unknown> = {};
  const chain = () => pass;
  pass.select = chain;
  pass.eq = chain;
  pass.gte = chain;
  pass.lt = chain;
  pass.not = chain;
  pass.order = chain;
  pass.limit = chain;
  pass.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
  return { supabaseAdmin: { from: () => pass } };
});

vi.mock("@/src/lib/api/webhooks", () => ({
  emitDealershipEvent: vi.fn(),
}));

const mixedRows = {
  users: [
    { id: "ua", full_name: "Alice", dealership_id: DEALER_A, is_active: true, role: "Admin" },
    { id: "ub", full_name: "Bob", dealership_id: DEALER_B, is_active: true, role: "Admin" },
  ],
  customers: [
    { id: "ca", name: "Cust A", dealership_id: DEALER_A, assigned_to: "ua" },
    { id: "cb", name: "Cust B", dealership_id: DEALER_B, assigned_to: "ub" },
  ],
  sales_deals: [
    { id: "da", sale_price: 1000, dealership_id: DEALER_A, salesperson: { full_name: "Alice" } },
    { id: "db", sale_price: 9000, dealership_id: DEALER_B, salesperson: { full_name: "Bob" } },
  ],
  leads: [
    { id: "la", dealership_id: DEALER_A, assigned_user: { full_name: "Alice" } },
    { id: "lb", dealership_id: DEALER_B, assigned_user: { full_name: "Bob" } },
  ],
  vehicles: [
    { id: "va", vin: "SHAREDVIN000000001", status: "Active", dealership_id: DEALER_A, stock_number: "A1" },
    { id: "vb", vin: "SHAREDVIN000000001", status: "Active", dealership_id: DEALER_B, stock_number: "B1" },
  ],
  invoices: [
    { id: "ia", status: "Pending", dealership_id: DEALER_A },
    { id: "ib", status: "Pending", dealership_id: DEALER_B },
  ],
  dealerships: [{ id: DEALER_A }, { id: DEALER_B }],
  roles: [
    { id: "ra", name: "Admin", dealership_id: DEALER_A, is_system: true },
    { id: "rb", name: "Admin", dealership_id: DEALER_B, is_system: true },
  ],
  expenses: [
    { id: "ea", amount: 10, dealership_id: DEALER_A },
    { id: "eb", amount: 90, dealership_id: DEALER_B },
  ],
  email_sequences: [
    { id: "esa", name: "Nurture A", dealership_id: DEALER_A },
    { id: "esb", name: "Nurture B", dealership_id: DEALER_B },
  ],
  locations: [
    { id: "loca", name: "A lot", dealership_id: DEALER_A, is_active: true, is_primary: true },
    { id: "locb", name: "B lot", dealership_id: DEALER_B, is_active: true, is_primary: true },
  ],
  bill_of_sale: [
    { id: "bosa", dealership_id: DEALER_A },
    { id: "bosb", dealership_id: DEALER_B },
  ],
  ocr_documents: [
    { id: "ocra", dealership_id: DEALER_A },
    { id: "ocrb", dealership_id: DEALER_B },
  ],
  finance_calculations: [
    { id: "fca", dealership_id: DEALER_A },
    { id: "fcb", dealership_id: DEALER_B },
  ],
};

function dealerTenant(dealershipId: string, isPlatformAdmin = false) {
  const profile = {
    id: dealershipId === DEALER_A ? "ua" : "ub",
    dealership_id: dealershipId,
    is_platform_admin: isPlatformAdmin,
    role: "Admin",
    user_permissions: ["*"],
    is_active: true,
  };
  return {
    ok: true as const,
    auth: {
      user: { id: profile.id },
      profile,
      dealership_id: dealershipId,
      error: null,
    },
    supabase: createClient(mixedRows),
    isPlatformAdmin,
  };
}

function platformTenant(rooftop?: string) {
  const profile = {
    id: "platform",
    dealership_id: null,
    is_platform_admin: true,
    role: "Admin",
    user_permissions: ["*"],
    is_active: true,
  };
  return {
    ok: true as const,
    auth: {
      user: { id: profile.id },
      profile,
      dealership_id: rooftop || "",
      error: null,
    },
    supabase: createClient(mixedRows),
    isPlatformAdmin: true,
  };
}

function unboundDealer() {
  const profile = {
    id: "ux",
    dealership_id: null,
    is_platform_admin: false,
    role: "Admin",
    user_permissions: ["*"],
    is_active: true,
  };
  return {
    ok: true as const,
    auth: {
      user: { id: profile.id },
      profile,
      dealership_id: "",
      error: null,
    },
    supabase: createClient(mixedRows),
    isPlatformAdmin: false,
  };
}

describe("tenant isolation lists", () => {
  beforeEach(() => {
    requireTenantClient.mockReset();
  });

  it("GET /api/users as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/users/route");
    const res = await GET(
      new NextRequest("http://localhost/api/users?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((u) => u.id)).toEqual(["ua"]);
  });

  it("GET /api/customers as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/customers/route");
    const res = await GET(
      new NextRequest("http://localhost/api/customers?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((c) => c.id)).toEqual(["ca"]);
  });

  it("GET /api/deals as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/deals/route");
    const res = await GET(
      new NextRequest("http://localhost/api/deals?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((d) => d.id)).toEqual(["da"]);
  });

  it("GET /api/dashboard as dealer A has no dealer B salesperson names", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/dashboard/route");
    const res = await GET(new NextRequest("http://localhost/api/dashboard"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recentSales: Array<{ id: string; salesperson?: { full_name?: string } }>;
      recentLeads: Array<{ id: string }>;
      stats: { totalCustomers: number };
    };
    expect(body.recentSales.map((s) => s.id)).toEqual(["da"]);
    expect(
      body.recentSales.some((s) => s.salesperson?.full_name === "Bob")
    ).toBe(false);
    expect(body.recentLeads.map((l) => l.id)).toEqual(["la"]);
    expect(body.stats.totalCustomers).toBe(1);
  });

  it("platform with explicit rooftop can still see that rooftop", async () => {
    requireTenantClient.mockResolvedValue(platformTenant(DEALER_B));
    const { GET } = await import("@/src/app/api/customers/route");
    const res = await GET(
      new NextRequest(
        `http://localhost/api/customers?dealership_id=${DEALER_B}`
      )
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((c) => c.id)).toEqual(["cb"]);
  });

  it("platform users list without rooftop stays global (AdaptUs All Users)", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/users/route");
    const res = await GET(new NextRequest("http://localhost/api/users"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((u) => u.id).sort()).toEqual(["ua", "ub"]);
  });

  it("platform without rooftop cannot list vehicles globally", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/vehicles/route");
    const res = await GET(new NextRequest("http://localhost/api/vehicles"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toEqual([]);
  });

  it("platform with rooftop lists only that rooftop's vehicles", async () => {
    requireTenantClient.mockResolvedValue(platformTenant(DEALER_B));
    const { GET } = await import("@/src/app/api/vehicles/route");
    const res = await GET(
      new NextRequest(
        `http://localhost/api/vehicles?dealership_id=${DEALER_B}`
      )
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((v) => v.id)).toEqual(["vb"]);
  });

  it("dealer cannot list another rooftop's vehicles via query", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/vehicles/route");
    const res = await GET(
      new NextRequest(
        `http://localhost/api/vehicles?dealership_id=${DEALER_B}`
      )
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((v) => v.id)).toEqual(["va"]);
  });

  it("platform dashboard without rooftop does not mix salesperson names", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/dashboard/route");
    const res = await GET(new NextRequest("http://localhost/api/dashboard"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recentSales: unknown[];
      recentLeads: unknown[];
    };
    expect(body.recentSales).toEqual([]);
    expect(body.recentLeads).toEqual([]);
  });

  it("GET /api/sales as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/sales/route");
    const res = await GET(
      new NextRequest("http://localhost/api/sales?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((d) => d.id)).toEqual(["da"]);
  });

  it("GET /api/roles as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/roles/route");
    const res = await GET(new NextRequest("http://localhost/api/roles"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((r) => r.id)).toEqual(["ra"]);
  });

  it("platform without rooftop cannot list roles globally", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/roles/route");
    const res = await GET(new NextRequest("http://localhost/api/roles"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toEqual([]);
  });

  it("GET /api/expenses as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/expenses/route");
    const res = await GET(
      new NextRequest("http://localhost/api/expenses?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((e) => e.id)).toEqual(["ea"]);
  });

  it("dealer without dealership_id cannot list sales", async () => {
    requireTenantClient.mockResolvedValue(unboundDealer());
    const { GET } = await import("@/src/app/api/sales/route");
    const res = await GET(new NextRequest("http://localhost/api/sales"));
    expect(res.status).toBe(403);
  });

  it("GET /api/users/[id] as dealer A cannot read dealer B staff", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/users/[id]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/users/ub"),
      { params: Promise.resolve({ id: "ub" }) }
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/roles/[id] as dealer A cannot read dealer B role", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/roles/[id]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/roles/rb"),
      { params: Promise.resolve({ id: "rb" }) }
    );
    expect(res.status).toBe(404);
  });

  it("platform without rooftop cannot dump email sequences", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/email-sequences/route");
    const res = await GET(
      new NextRequest("http://localhost/api/email-sequences")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toEqual([]);
  });

  it("GET /api/settings/locations as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/settings/locations/route");
    const res = await GET(
      new NextRequest("http://localhost/api/settings/locations")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((l) => l.id)).toEqual(["loca"]);
  });

  it("shared VIN list as dealer A returns only dealer A's vehicle", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/vehicles/route");
    const res = await GET(
      new NextRequest("http://localhost/api/vehicles?vin=SHAREDVIN000000001&limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; stock_number?: string }> };
    expect(body.data.map((v) => v.id)).toEqual(["va"]);
    expect(body.data[0]?.stock_number).toBe("A1");
  });

  it("shared VIN list as dealer B returns only dealer B's vehicle", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_B));
    const { GET } = await import("@/src/app/api/vehicles/route");
    const res = await GET(
      new NextRequest("http://localhost/api/vehicles?vin=SHAREDVIN000000001&limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; stock_number?: string }> };
    expect(body.data.map((v) => v.id)).toEqual(["vb"]);
    expect(body.data[0]?.stock_number).toBe("B1");
  });

  it("platform without rooftop cannot dump bills of sale", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/bill-of-sale/route");
    const res = await GET(new NextRequest("http://localhost/api/bill-of-sale"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toEqual([]);
  });

  it("GET /api/bill-of-sale as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/bill-of-sale/route");
    const res = await GET(
      new NextRequest("http://localhost/api/bill-of-sale?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((b) => b.id)).toEqual(["bosa"]);
  });

  it("platform without rooftop cannot dump OCR documents", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/ocr-documents/route");
    const res = await GET(
      new NextRequest("http://localhost/api/ocr-documents")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toEqual([]);
  });

  it("GET /api/ocr-documents as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/ocr-documents/route");
    const res = await GET(
      new NextRequest("http://localhost/api/ocr-documents")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((d) => d.id)).toEqual(["ocra"]);
  });

  it("platform without rooftop cannot dump finance calculations", async () => {
    requireTenantClient.mockResolvedValue(platformTenant());
    const { GET } = await import("@/src/app/api/finance-calculations/route");
    const res = await GET(
      new NextRequest("http://localhost/api/finance-calculations")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toEqual([]);
  });

  it("GET /api/finance-calculations as dealer A does not include dealer B", async () => {
    requireTenantClient.mockResolvedValue(dealerTenant(DEALER_A));
    const { GET } = await import("@/src/app/api/finance-calculations/route");
    const res = await GET(
      new NextRequest("http://localhost/api/finance-calculations?limit=50")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((c) => c.id)).toEqual(["fca"]);
  });
});
