import { describe, expect, it } from "vitest";
import {
  buildBuyersGuidePdfBytes,
  buildCompliancePackPdfBytes,
  buildKnownDamageDisclosurePdfBytes,
  buildRetentionExportJson,
  buildWeOwePdfBytes,
  retentionFileName,
  rowCounts,
  rowsToCsv,
  type RetentionExportBundle,
} from "@/src/lib/audit";

describe("retention export helpers", () => {
  it("sanitizes dealership names into file names", () => {
    expect(retentionFileName("  Big Joe's Auto Co.!!  ")).toMatch(
      /^flashfender-big-joe-s-auto-co-retention-\d{4}-\d{2}-\d{2}\.json$/
    );
    expect(retentionFileName(null)).toMatch(/^flashfender-dealership-retention-/);
  });

  it("counts rows per table", () => {
    const counts = rowCounts({ vehicles: [{}, {}], invoices: [] });
    expect(counts).toEqual({ vehicles: 2, invoices: 0 });
  });

  it("serializes rows to CSV", () => {
    const csv = rowsToCsv([
      { id: "1", name: 'O"Brien, Jack' },
      { id: "2", name: "Jane" },
    ]);
    expect(csv).toContain('"O""Brien, Jack"');
    expect(csv).toContain("Jane");
  });

  it("builds a versioned JSON bundle", () => {
    const bundle: RetentionExportBundle = {
      format: "flashfender-retention-export",
      formatVersion: 1,
      generated_at: "2026-08-08T00:00:00.000Z",
      dealership: { id: "d1", name: "Acme Auto" },
      exported_by: { id: "u1", email: "a@b.c", role: "Admin" },
      retentionYears: 10,
      tables: { vehicles: [{ vin: "123" }] },
    };
    const json = buildRetentionExportJson(bundle);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe("flashfender-retention-export");
    expect(parsed.retentionYears).toBe(10);
  });
});

function pdfHeader(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes.subarray(0, 8));
}

describe("compliance PDF builders", () => {
  it("builds a non-empty we-owe PDF", async () => {
    const bytes = await buildWeOwePdfBytes({
      dealer: { name: "Acme Auto" },
      customerName: "Jane Doe",
      vehicleLabel: "2022 Honda Civic",
      vin: "2HGFC2F55NH123456",
      items: ["Deliver second key"],
    });
    expect(bytes.length).toBeGreaterThan(100);
    expect(pdfHeader(bytes)).toContain("%PDF"); // pdf-lib emits a valid PDF header
  });

  it("builds buyer's guide and known-damage PDFs", async () => {
    const guide = await buildBuyersGuidePdfBytes({
      dealer: { name: "Acme Auto" },
      vehicleLabel: "2022 Honda Civic",
      vin: "2HGFC2F55NH123456",
      warrantyOption: "AS-IS",
    });
    const damage = await buildKnownDamageDisclosurePdfBytes({
      dealer: { name: "Acme Auto" },
      vehicleLabel: "2022 Honda Civic",
      vin: "2HGFC2F55NH123456",
      disclosure: "Repaired rear quarter panel.",
    });
    expect(pdfHeader(guide)).toContain("%PDF");
    expect(pdfHeader(damage)).toContain("%PDF");
  });

  it("combines a compliance pack", async () => {
    const docs = [
      {
        type: "we_owe" as const,
        bytes: await buildWeOwePdfBytes({ items: ["x"] }),
      },
      {
        type: "buyers_guide" as const,
        bytes: await buildBuyersGuidePdfBytes({}),
      },
    ];
    const pack = await buildCompliancePackPdfBytes(docs);
    expect(pdfHeader(pack)).toContain("%PDF");
    expect(pack.length).toBeGreaterThan(docs[0]!.bytes.length);
  });
});
