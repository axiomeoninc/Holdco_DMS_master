import { describe, expect, it } from "vitest";
import {
  normalizeInvoiceDocument,
  parseInvoiceLineItems,
  resolveInvoiceLineItems,
  resolveInvoiceStatusStamp,
} from "@/src/lib/invoice-pdf";

describe("resolveInvoiceLineItems", () => {
  it("uses provided line items and fills amount from qty × unitPrice", () => {
    const items = resolveInvoiceLineItems({
      subtotal: 100,
      lineItems: [
        { description: "Detail", qty: 2, unitPrice: 50, amount: 0 },
      ],
    });
    expect(items).toEqual([
      { description: "Detail", qty: 2, unitPrice: 50, amount: 100 },
    ]);
  });

  it("falls back to package / subtotal when no lines", () => {
    expect(
      resolveInvoiceLineItems({
        packageName: "Gold package",
        subtotal: 999,
      })
    ).toEqual([
      {
        description: "Gold package",
        qty: 1,
        unitPrice: 999,
        amount: 999,
      },
    ]);
  });
});

describe("resolveInvoiceStatusStamp", () => {
  const nowMs = Date.parse("2026-06-15T12:00:00.000Z");

  it("maps cancelled / paid status", () => {
    expect(
      resolveInvoiceStatusStamp({ status: "cancelled", total: 100, nowMs })
    ).toBe("CANCELLED");
    expect(
      resolveInvoiceStatusStamp({ status: "paid", total: 100, nowMs })
    ).toBe("PAID");
  });

  it("derives PARTIAL and OVERDUE from amounts / due date", () => {
    expect(
      resolveInvoiceStatusStamp({
        total: 100,
        amountPaid: 40,
        nowMs,
      })
    ).toBe("PARTIAL");
    expect(
      resolveInvoiceStatusStamp({
        status: "pending",
        total: 100,
        amountPaid: 0,
        dueDate: "2026-01-01",
        nowMs,
      })
    ).toBe("OVERDUE");
  });

  it("defaults to PENDING", () => {
    expect(
      resolveInvoiceStatusStamp({
        total: 50,
        amountPaid: 0,
        dueDate: "2026-12-01",
        nowMs,
      })
    ).toBe("PENDING");
  });
});

describe("normalizeInvoiceDocument", () => {
  it("fills statusStamp, lineItems, and paymentInstructions", () => {
    const doc = normalizeInvoiceDocument(
      {
        invoiceNumber: "INV-1",
        subtotal: 100,
        taxRate: 0.13,
        taxAmount: 13,
        total: 113,
        notes: "Wire CAD",
        status: "pending",
      },
      { nowMs: Date.parse("2026-01-01T00:00:00.000Z") }
    );
    expect(doc.statusStamp).toBe("PENDING");
    expect(doc.lineItems?.length).toBe(1);
    expect(doc.paymentInstructions).toBe("Wire CAD");
  });
});

describe("parseInvoiceLineItems", () => {
  it("parses snake_case rows and ignores empty junk", () => {
    const items = parseInvoiceLineItems([
      { name: "Labour", quantity: 1, unit_price: 80 },
      { description: "", amount: 0 },
      null,
    ]);
    expect(items).toEqual([
      { description: "Labour", qty: 1, unitPrice: 80, amount: 80 },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(parseInvoiceLineItems(undefined)).toEqual([]);
    expect(parseInvoiceLineItems("x")).toEqual([]);
  });
});
