/**
 * One-click full dealership data export (JSON + XLSX).
 * Uses exceljs (SheetJS Community Edition is unmaintained).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sheetsToXlsxBuffer } from "@/src/lib/export/xlsx-workbook";

export type ExportBundle = {
  generated_at: string;
  dealership: Record<string, unknown> | null;
  vehicles: unknown[];
  customers: unknown[];
  leads: unknown[];
  deals: unknown[];
  quotations: unknown[];
  invoices: unknown[];
  expenses: unknown[];
  sms_messages: unknown[];
  dealership_events: unknown[];
  webhook_deliveries: unknown[];
};

/** Pull every dealership table we own read access to. */
export async function gatherDealershipExport(
  supabase: SupabaseClient,
  dealershipId: string
): Promise<ExportBundle> {
  const [dealership, vehicles, customers, leads, deals, quotations, invoices, expenses, smsMessages, dealershipEvents, webhookDeliveries] =
    await Promise.all([
      supabase
        .from("dealerships")
        .select("*")
        .eq("id", dealershipId)
        .maybeSingle(),
      supabase.from("vehicles").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("customers").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("leads").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("sales_deals").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("quotations").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("sms_messages").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("dealership_events").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
      supabase.from("webhook_deliveries").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
    ]);

  if (dealership.error) throw dealership.error;

  const pick = (r: { data: unknown[] | null; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data || [];
  };

  return {
    generated_at: new Date().toISOString(),
    dealership: dealership.data as Record<string, unknown> | null,
    vehicles: pick(vehicles),
    customers: pick(customers),
    leads: pick(leads),
    deals: pick(deals),
    quotations: pick(quotations),
    invoices: pick(invoices),
    expenses: pick(expenses),
    sms_messages: pick(smsMessages),
    dealership_events: pick(dealershipEvents),
    webhook_deliveries: pick(webhookDeliveries),
  };
}

export function toJsonBuffer(bundle: ExportBundle): Buffer {
  return Buffer.from(JSON.stringify(bundle, null, 2), "utf8");
}

/** Flatten arrays of objects for a worksheet (JSON values become JSON strings). */
function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const rec = r as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v === null || v === undefined) out[k] = "";
      else if (typeof v === "object") out[k] = JSON.stringify(v);
      else out[k] = v;
    }
    return out;
  });
}

export async function toXlsxBuffer(bundle: ExportBundle): Promise<Buffer> {
  const sheets: Array<[string, unknown[]]> = [
    ["dealership", bundle.dealership ? [bundle.dealership] : []],
    ["vehicles", bundle.vehicles],
    ["customers", bundle.customers],
    ["leads", bundle.leads],
    ["deals", bundle.deals],
    ["quotations", bundle.quotations],
    ["invoices", bundle.invoices],
    ["expenses", bundle.expenses],
    ["sms_messages", bundle.sms_messages],
    ["webhook_deliveries", bundle.webhook_deliveries],
  ];
  return sheetsToXlsxBuffer(
    sheets.map(([name, rows]) => ({
      name,
      rows: normalizeRows(rows),
    }))
  );
}
