import { apiFetch } from '@/lib/api';
import {
  asFiniteNumber,
  asString,
  isRecord,
  listPayload,
  unwrapData,
} from '@/lib/parse';
import type {
  CreateDealInput,
  Deal,
  DealListResult,
  DealVehicleSummary,
  LeadCustomerSummary,
} from '@/lib/types';

function parseCustomerSummary(value: unknown): LeadCustomerSummary | null {
  if (!isRecord(value)) return null;
  const nameFromParts = [asString(value.first_name), asString(value.last_name)]
    .filter((part): part is string => part !== null)
    .join(' ');
  return {
    id: asString(value.id),
    name: asString(value.name) ?? (nameFromParts.length > 0 ? nameFromParts : null),
    email: asString(value.email),
    phone: asString(value.phone),
  };
}

function parseVehicleSummary(value: unknown): DealVehicleSummary | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    year: asFiniteNumber(value.year),
    make: asString(value.make),
    model: asString(value.model),
    vin: asString(value.vin),
  };
}

export function parseDeal(value: unknown): Deal | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    deal_status: asString(value.deal_status) ?? asString(value.status),
    sale_price: asFiniteNumber(value.sale_price),
    down_payment: asFiniteNumber(value.down_payment),
    trade_in_value: asFiniteNumber(value.trade_in_value),
    finance_term: asFiniteNumber(value.finance_term),
    interest_rate: asFiniteNumber(value.interest_rate),
    created_at: asString(value.created_at),
    customer: parseCustomerSummary(value.customer),
    vehicle: parseVehicleSummary(value.vehicle),
  };
}

export function parseDealList(body: unknown): DealListResult {
  const { raw, count } = listPayload(body);
  const deals: Deal[] = [];
  for (const item of raw) {
    const deal = parseDeal(item);
    if (deal) deals.push(deal);
  }
  return { deals, count };
}

export type ListDealsParams = {
  q?: string;
  limit?: number;
};

export async function listDeals(params: ListDealsParams = {}): Promise<DealListResult> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 50));
  const q = params.q?.trim();
  if (q) search.set('q', q);
  const body = await apiFetch(`/api/deals?${search.toString()}`);
  return parseDealList(body);
}

export async function getDeal(id: string): Promise<Deal> {
  const body = await apiFetch(`/api/deals/${encodeURIComponent(id)}`);
  const deal = parseDeal(unwrapData(body));
  if (!deal) throw new Error('Invalid deal response');
  return deal;
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const body = await apiFetch('/api/deals', {
    method: 'POST',
    body: {
      vehicle_id: input.vehicle_id,
      sale_price: input.sale_price,
      ...(input.customer_id ? { customer_id: input.customer_id } : {}),
      ...(input.deal_status ? { deal_status: input.deal_status } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    },
  });
  const deal = parseDeal(unwrapData(body));
  if (!deal) throw new Error('Invalid create-deal response');
  return deal;
}

export function dealTitle(deal: Deal): string {
  const vehicle = deal.vehicle;
  if (vehicle) {
    const parts: string[] = [];
    if (vehicle.year !== null) parts.push(String(vehicle.year));
    if (vehicle.make) parts.push(vehicle.make);
    if (vehicle.model) parts.push(vehicle.model);
    if (parts.length > 0) return parts.join(' ');
  }
  if (deal.customer?.name) return deal.customer.name;
  return 'Deal';
}

export function formatPriceCad(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(value);
}

/**
 * Client-side desking estimate only — not a lender commitment.
 * principal = sale − down − trade
 */
export function estimateMonthlyPayment(deal: Deal): number | null {
  const sale = deal.sale_price;
  if (sale === null) return null;
  const down = deal.down_payment ?? 0;
  const trade = deal.trade_in_value ?? 0;
  const principal = sale - down - trade;
  if (principal <= 0) return 0;

  const term = deal.finance_term;
  if (term === null || term <= 0) return null;

  const annualPct = deal.interest_rate;
  if (annualPct === null || annualPct <= 0) {
    return principal / term;
  }

  const r = annualPct / 100 / 12;
  const factor = Math.pow(1 + r, term);
  return (principal * r * factor) / (factor - 1);
}
