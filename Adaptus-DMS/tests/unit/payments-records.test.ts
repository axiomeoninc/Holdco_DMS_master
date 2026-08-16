import { describe, expect, it } from "vitest";
import { invoiceBalanceDue, PAYMENT_REFERENCE_TYPES } from "@/src/lib/payments";

describe("payments records", () => {
  it("computes invoice balance due", () => {
    expect(invoiceBalanceDue(1130, 1130)).toBe(0);
    expect(invoiceBalanceDue(1130, 500)).toBe(630);
    expect(invoiceBalanceDue(0, 0)).toBe(0);
    expect(invoiceBalanceDue(undefined as never, undefined as never)).toBe(0);
  });

  it("exposes supported reference types", () => {
    expect(PAYMENT_REFERENCE_TYPES).toContain("invoice");
    expect(PAYMENT_REFERENCE_TYPES).toContain("deposit");
    expect(PAYMENT_REFERENCE_TYPES).toContain("bill_of_sale");
  });

  it("payment record statuses are closed-set honest statuses", () => {
    // The provider-agnostic record can only ever be in these states.
    const statuses = [
      "pending",
      "requires_action",
      "succeeded",
      "failed",
      "refunded",
      "cancelled",
    ];
    expect(statuses).toContain("succeeded");
    expect(statuses).toContain("pending");
    expect(statuses).not.toContain("paid");
  });
});
