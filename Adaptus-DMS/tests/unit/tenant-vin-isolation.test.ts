import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
    findVehicleByVinOrId,
    VIN_LOOKUP_NEEDS_ACT_AS,
    VIN_LOOKUP_NO_CONTEXT,
} from "@/src/lib/vehicle-lookup";
import {
    parseVehiclesBucketPath,
    vehicleStorageFolder,
    UnprefixedVehicleStorageError,
} from "@/src/lib/vehicle-storage";

const DRIP = "4d43b08c-3d56-4b3f-b465-c8dd5d50e62e";
const NOVA = "dd404bb6-3e64-43ae-9eb7-98095033c6cb";
const SHARED_VIN = "1C4HJXDG4NW134868";
const DRIP_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOVA_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOVA_ONLY_VIN = "NOVAONLYVIN000001";

const requireDealershipAccess = vi.fn();
const pickSupabaseClient = vi.fn();

const { createClient, db, supabaseAdminMock } = vi.hoisted(() => {
  type RowInner = Record<string, unknown>;
  const DRIP_ID = "4d43b08c-3d56-4b3f-b465-c8dd5d50e62e";
  const NOVA_ID = "dd404bb6-3e64-43ae-9eb7-98095033c6cb";
  const SHARED = "1C4HJXDG4NW134868";
  const DRIP_ROW = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const NOVA_ROW = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const NOVA_ONLY = "NOVAONLYVIN000001";
  function createClientInner(rowsByTable: Record<string, RowInner[]>) {
    const from = (table: string) => {
      const filters: Array<[string, unknown]> = [];
      const q: Record<string, unknown> = {};
      const apply = (): { data: RowInner[]; error: null; count: number } => {
        let data = (rowsByTable[table] || []).slice();
        for (const [column, value] of filters) {
          data = data.filter((row) => row[column] === value);
        }
        return { data, error: null, count: data.length };
      };
      const chain = () => q;
      q.select = chain;
      q.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return q;
      };
      q.order = chain;
      q.range = chain;
      q.limit = chain;
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
  const dbInner = {
    vehicles: [
      {
        id: DRIP_ROW,
        vin: SHARED,
        dealership_id: DRIP_ID,
        stock_number: "DM-1",
        status: "Active",
        known_damage: false,
        disclosure: null,
      },
      {
        id: NOVA_ROW,
        vin: SHARED,
        dealership_id: NOVA_ID,
        stock_number: "134868",
        status: "Active",
        known_damage: false,
        disclosure: null,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        vin: NOVA_ONLY,
        dealership_id: NOVA_ID,
        stock_number: "X",
        status: "Active",
        known_damage: false,
        disclosure: null,
      },
    ],
    dealerships: [
      { id: DRIP_ID, name: "Drip Motors Inc", slug: "drip-motors", status: "Active", settings: {}, business_name: "Drip Motors Inc" },
      { id: NOVA_ID, name: "Nova Motors", slug: "nova-motors", status: "Active", settings: {}, business_name: "Nova Motors" },
    ],
  };
  return {
    createClient: createClientInner,
    db: dbInner,
    supabaseAdminMock: createClientInner(dbInner),
  };
});

vi.mock("@/src/lib/auth-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/auth-helpers")>(
    "@/src/lib/auth-helpers"
  );
  return {
    ...actual,
    requireDealershipAccess,
    pickSupabaseClient,
  };
});

vi.mock("@/src/lib/supabase-admin", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

function dealerAuth(dealershipId: string) {
  const profile = {
    id: "user-1",
    email: "a@x.com",
    role: "Admin",
    dealership_id: dealershipId,
    is_platform_admin: false,
    full_name: "Admin",
    phone: null,
    avatar: null,
    is_active: true,
    user_permissions: ["*"],
  };
  return {
    user: { id: profile.id },
    profile,
    error: null,
    dealership_id: dealershipId,
  };
}

describe("findVehicleByVinOrId rooftop scope", () => {
  it("returns the Drip row for a shared VIN when Drip rooftop is set", async () => {
    const found = await findVehicleByVinOrId(createClient(db) as never, SHARED_VIN, {
      dealershipId: DRIP,
    });
    expect(found.vehicle).toMatchObject({ id: DRIP_UUID, stock_number: "DM-1" });
    expect(found.ambiguous).toBe(false);
  });

  it("returns the Nova row for the same VIN when Nova rooftop is set", async () => {
    const found = await findVehicleByVinOrId(createClient(db) as never, SHARED_VIN, {
      dealershipId: NOVA,
    });
    expect(found.vehicle).toMatchObject({ id: NOVA_UUID, stock_number: "134868" });
  });

  it("does not return a Nova-only VIN from the Drip rooftop", async () => {
    const found = await findVehicleByVinOrId(createClient(db) as never, NOVA_ONLY_VIN, {
      dealershipId: DRIP,
    });
    expect(found.vehicle).toBeNull();
  });

  it("refuses platform VIN lookup without Act-as rooftop", async () => {
    const found = await findVehicleByVinOrId(createClient(db) as never, SHARED_VIN, {
      isPlatformAdmin: true,
    });
    expect(found.vehicle).toBeNull();
    expect(found.error).toBe(VIN_LOOKUP_NEEDS_ACT_AS);
  });

  it("refuses dealer VIN lookup without dealership context", async () => {
    const found = await findVehicleByVinOrId(createClient(db) as never, SHARED_VIN, {});
    expect(found.error).toBe(VIN_LOOKUP_NO_CONTEXT);
  });
});

describe("vehicle storage prefix", () => {
  it("always prefixes dealership_id/vin", () => {
    expect(vehicleStorageFolder(DRIP, SHARED_VIN)).toBe(`${DRIP}/${SHARED_VIN}`);
  });

  it("never falls back to unprefixed {vin}/", () => {
    expect(() => vehicleStorageFolder(null, SHARED_VIN)).toThrow(UnprefixedVehicleStorageError);
    expect(() => vehicleStorageFolder("", SHARED_VIN)).toThrow(UnprefixedVehicleStorageError);
  });

  it("parses public gallery URLs to object paths", () => {
    const url = `https://example.supabase.co/storage/v1/object/public/vehicles/${DRIP}/${SHARED_VIN}/001.jpg`;
    expect(parseVehiclesBucketPath(url)).toBe(`${DRIP}/${SHARED_VIN}/001.jpg`);
  });
});

describe("vehicle GET by VIN/id and public slugs", () => {
  beforeEach(() => {
    requireDealershipAccess.mockReset();
    pickSupabaseClient.mockReset();
  });

  it("GET /api/vehicles/{novaOnlyVin} as Drip is 404", async () => {
    requireDealershipAccess.mockResolvedValue(dealerAuth(DRIP));
    pickSupabaseClient.mockReturnValue({
      supabase: createClient(db),
      isPlatformAdmin: false,
    });
    const { GET } = await import("@/src/app/api/vehicles/[id]/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/vehicles/${NOVA_ONLY_VIN}`),
      { params: Promise.resolve({ id: NOVA_ONLY_VIN }) }
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/vehicles/{novaUuid} as Drip is 404", async () => {
    requireDealershipAccess.mockResolvedValue(dealerAuth(DRIP));
    pickSupabaseClient.mockReturnValue({
      supabase: createClient(db),
      isPlatformAdmin: false,
    });
    const { GET } = await import("@/src/app/api/vehicles/[id]/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/vehicles/${NOVA_UUID}`),
      { params: Promise.resolve({ id: NOVA_UUID }) }
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/vehicles/{sharedVin} as Drip returns Drip's row", async () => {
    requireDealershipAccess.mockResolvedValue(dealerAuth(DRIP));
    pickSupabaseClient.mockReturnValue({
      supabase: createClient(db),
      isPlatformAdmin: false,
    });
    const { GET } = await import("@/src/app/api/vehicles/[id]/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/vehicles/${SHARED_VIN}`),
      { params: Promise.resolve({ id: SHARED_VIN }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(DRIP_UUID);
  });

  it("public slug drip-motors does not include Nova vehicle ids", async () => {
    const { GET } = await import("@/src/app/api/vehicles/public/route");
    const drip = await GET(
      new NextRequest("http://localhost/api/vehicles/public?slug=drip-motors&limit=50")
    );
    const nova = await GET(
      new NextRequest("http://localhost/api/vehicles/public?slug=nova-motors&limit=50")
    );
    expect(drip.status).toBe(200);
    expect(nova.status).toBe(200);
    const dripBody = (await drip.json()) as { data: Array<{ id: string }> };
    const novaBody = (await nova.json()) as { data: Array<{ id: string }> };
    expect(dripBody.data.map((v) => v.id)).toEqual([DRIP_UUID]);
    expect(novaBody.data.map((v) => v.id).sort()).toEqual(
      [NOVA_UUID, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"].sort()
    );
    const overlap = dripBody.data.filter((v) =>
      novaBody.data.some((n) => n.id === v.id)
    );
    expect(overlap).toEqual([]);
  });
});
