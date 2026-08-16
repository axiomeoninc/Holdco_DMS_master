import { describe, expect, it } from "vitest";
import {
  buildReactivationCandidates,
  daysSinceService,
  DEFAULT_REACTIVATION_DAYS,
  SERVICE_TYPES,
  SERVICE_STATUSES,
} from "@/src/lib/service";
import {
  normalizeAuctionLotInfo,
  provenanceLabel,
  isAuctionSourced,
  SOURCE_KINDS,
} from "@/src/lib/auction";

describe("service module — reactivation candidates", () => {
  const nowMs = new Date("2026-08-08T00:00:00.000Z").getTime();

  it("includes only consented customers whose last service is older than the threshold", () => {
    const candidates = buildReactivationCandidates(
      [
        {
          service_date: "2025-01-01", // > 180 days ago
          service_type: "oil_change",
          customer_id: "c1",
          customer_name: "Consented Jane",
          email: "jane@example.com",
          phone: null,
          service_contact_consent: true,
          vehicle_label: "2022 Honda Civic",
        },
        {
          service_date: "2025-01-01", // > 180 days ago but NO consent
          service_type: "oil_change",
          customer_id: "c2",
          customer_name: "No Consent Bob",
          email: null,
          phone: "555",
          service_contact_consent: false,
          vehicle_label: null,
        },
        {
          service_date: "2026-07-01", // recent, must be excluded
          service_type: "repair",
          customer_id: "c3",
          customer_name: "Recent Sam",
          email: null,
          phone: null,
          service_contact_consent: true,
          vehicle_label: null,
        },
      ],
      { nowMs }
    );

    expect(candidates.map((c) => c.customer_name)).toEqual(["Consented Jane"]);
    expect(candidates[0]!.days_since_last_service).toBeGreaterThan(180);
    expect(candidates[0]!.service_contact_consent).toBe(true);
  });

  it("uses the latest service per customer", () => {
    const candidates = buildReactivationCandidates(
      [
        {
          service_date: "2025-01-01",
          service_type: "oil_change",
          customer_id: "c1",
          customer_name: "Jane",
          email: null,
          phone: null,
          service_contact_consent: true,
          vehicle_label: "Car A",
        },
        {
          service_date: "2026-06-01", // newer but still > threshold? no — within 180d of Aug 8
          service_type: "brake",
          customer_id: "c1",
          customer_name: "Jane",
          email: null,
          phone: null,
          service_contact_consent: true,
          vehicle_label: "Car B",
        },
      ],
      { nowMs, thresholdDays: 30 }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.last_service_type).toBe("brake");
    expect(candidates[0]!.last_vehicle_label).toBe("Car B");
  });

  it("exposes a sane default threshold and closed status/type sets", () => {
    expect(DEFAULT_REACTIVATION_DAYS).toBe(180);
    expect(SERVICE_TYPES).toContain("oil_change");
    expect(SERVICE_STATUSES).toContain("completed");
    expect(daysSinceService("2026-01-01", nowMs)).toBeGreaterThan(180);
  });
});

describe("auction sourcing helpers", () => {
  it("normalizes auction lot capture", () => {
    const info = normalizeAuctionLotInfo({
      source_kind: "auction",
      auction_venue: "  ADESA Toronto  ",
      auction_lot_number: "4821",
      auction_sale_date: "2026-07-15T00:00:00.000Z",
      comp_notes: " Clean unit, minor curb rash. ",
    });
    expect(info.source_kind).toBe("auction");
    expect(info.auction_venue).toBe("ADESA Toronto");
    expect(info.auction_lot_number).toBe("4821");
    expect(info.auction_sale_date).toBe("2026-07-15");
    expect(info.comp_notes).toBe("Clean unit, minor curb rash.");
  });

  it("rejects unknown source kinds (honest closed set)", () => {
    const info = normalizeAuctionLotInfo({ source_kind: "blackbook" });
    expect(info.source_kind).toBeNull();
    expect(SOURCE_KINDS).not.toContain("blackbook");
  });

  it("builds provenance labels without inventing market data", () => {
    expect(
      provenanceLabel({
        source_kind: "auction",
        auction_venue: "ADESA",
        auction_lot_number: "99",
        auction_sale_date: "2026-07-15",
      })
    ).toBe("ADESA · Lot #99 · 2026-07-15");
    expect(provenanceLabel({ source_kind: "wholesale" })).toBe("Wholesale");
    expect(provenanceLabel({})).toBeNull();
    expect(isAuctionSourced({ source_kind: "auction" })).toBe(true);
    expect(isAuctionSourced({ source_kind: "public" })).toBe(false);
  });
});
