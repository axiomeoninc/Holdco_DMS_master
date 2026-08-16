import { describe, expect, it } from "vitest";
import {
  buildAccountingExport,
  buildExpenseJournalRows,
  buildInvoiceJournalRows,
  buildJournalRows,
  buildPurchaseJournalRows,
  buildSaleJournalRows,
  isBalanced,
} from "@/src/lib/accounting";

describe("accounting journal rows", () => {
  it("builds balanced invoice entries (AR vs revenue + tax)", () => {
    const rows = buildInvoiceJournalRows([
      {
        id: "i1",
        invoice_number: "INV-100",
        invoice_date: "2026-01-05",
        total: 1130,
        tax_amount: 130,
        status: "Pending",
        customer: { name: "Acme Corp" },
      },
    ]);
    expect(isBalanced(rows)).toBe(true);
    const accounts = rows.map((r) => r.account);
    expect(accounts).toContain("Accounts Receivable");
    expect(accounts).toContain("Sales Revenue");
    expect(accounts).toContain("Tax Collected");
  });

  it("excludes cancelled/lost deals from sale entries", () => {
    const rows = buildSaleJournalRows([
      {
        id: "s1",
        deal_date: "2026-02-01",
        sale_price: 25000,
        deal_status: "Cancelled",
      },
      {
        id: "s2",
        deal_date: "2026-02-02",
        sale_price: 18000,
        deal_status: "Closed",
      },
    ]);
    expect(rows.length).toBe(2); // one closed deal = two legs
    expect(isBalanced(rows)).toBe(true);
  });

  it("builds paid-expense entries and skips unpaid", () => {
    const rows = buildExpenseJournalRows([
      {
        id: "e1",
        expense_date: "2026-03-01",
        amount: 100,
        tax_amount: 13,
        category: "Rent",
        status: "Paid",
      },
      {
        id: "e2",
        expense_date: "2026-03-02",
        amount: 500,
        tax_amount: 65,
        category: "Parts",
        status: "Pending",
      },
    ]);
    expect(rows.length).toBe(2); // one paid expense = two legs
    expect(rows[0]!.account).toContain("Rent");
    expect(rows[0]!.debit).toBeCloseTo(113);
    expect(isBalanced(rows)).toBe(true);
  });

  it("builds purchase entries against AP", () => {
    const rows = buildPurchaseJournalRows([
      {
        id: "p1",
        purchase_date: "2026-04-01",
        purchase_price: 12000,
        seller_name: "Auction House",
        vehicle: { make: "Honda", model: "Civic", year: 2022 },
      },
    ]);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.account)).toContain(
      "Inventory - Vehicle Purchases"
    );
    expect(isBalanced(rows)).toBe(true);
  });

  it("buildJournalRows aggregates all sources and stays balanced", () => {
    const rows = buildJournalRows({
      invoices: [
        {
          id: "i",
          invoice_number: "INV-1",
          invoice_date: "2026-01-01",
          total: 565,
          tax_amount: 65,
        },
      ],
      sales: [
        { id: "s", deal_date: "2026-01-02", sale_price: 10000, deal_status: "Closed" },
      ],
      expenses: [
        {
          id: "e",
          expense_date: "2026-01-03",
          amount: 50,
          tax_amount: 6.5,
          category: "Advertising",
          status: "Paid",
        },
      ],
      purchases: [
        { id: "p", purchase_date: "2026-01-04", purchase_price: 8000 },
      ],
    });
    expect(rows.length).toBe(9); // invoice(3 legs) + sale(2) + expense(2) + purchase(2)
    expect(isBalanced(rows)).toBe(true);
  });
});

describe("accounting export serializers", () => {
  const rows = buildInvoiceJournalRows([
    {
      id: "i1",
      invoice_number: "INV-100",
      invoice_date: "2026-01-05",
      total: 1130,
      tax_amount: 130,
      status: "Pending",
      customer: { name: "Acme Corp" },
    },
  ]);

  it("emits QuickBooks IIF with TRNS/SPL legs", () => {
    const out = buildAccountingExport(rows, "quickbooks");
    expect(out.filename).toBe("flashfender-journal.IIF");
    expect(out.content).toContain("!TRNS");
    expect(out.content).toContain("!SPL");
    expect(out.content).toContain("GENERAL JOURNAL");
  });

  it("emits Xero journal CSV header + rows", () => {
    const out = buildAccountingExport(rows, "xero");
    expect(out.content).toContain("JournalDate,JournalNumber");
    expect(out.content).toContain("Acme Corp");
  });

  it("emits Sage 50 CSV with debit/credit columns", () => {
    const out = buildAccountingExport(rows, "sage50");
    expect(out.content).toContain("Date,Reference,Account,Debit,Credit,Memo,Customer");
    expect(out.content).toContain("1130.00");
  });
});
