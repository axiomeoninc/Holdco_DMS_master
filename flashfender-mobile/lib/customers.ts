import { apiFetch } from '@/lib/api';
import { CACHE_KEYS, withOfflineCache } from '@/lib/offlineCache';
import {
  asBoolean,
  asString,
  isRecord,
  listPayload,
  unwrapData,
} from '@/lib/parse';
import type {
  CreateCustomerInput,
  Customer,
  CustomerListResult,
  LeadCustomerSummary,
} from '@/lib/types';

function customerName(value: Record<string, unknown>): string | null {
  const direct = asString(value.name);
  if (direct) return direct;
  const parts = [asString(value.first_name), asString(value.last_name)]
    .filter((part): part is string => part !== null)
    .join(' ');
  return parts.length > 0 ? parts : null;
}

export function parseCustomer(value: unknown): Customer | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    name: customerName(value),
    email: asString(value.email),
    phone: asString(value.phone),
    status: asString(value.status),
    source: asString(value.source),
    // Consent is off unless the API explicitly returns true
    marketing_consent: asBoolean(value.marketing_consent) === true ? true : false,
    sms_consent: asBoolean(value.sms_consent) === true ? true : false,
    created_at: asString(value.created_at),
  };
}

export function parseCustomerList(body: unknown): CustomerListResult {
  const { raw, count } = listPayload(body);
  const customers: Customer[] = [];
  for (const item of raw) {
    const customer = parseCustomer(item);
    if (customer) customers.push(customer);
  }
  return { customers, count };
}

export type ListCustomersParams = {
  q?: string;
  limit?: number;
  skipCache?: boolean;
};

export async function listCustomers(
  params: ListCustomersParams = {},
): Promise<CustomerListResult> {
  const load = async (): Promise<CustomerListResult> => {
    const search = new URLSearchParams();
    search.set('limit', String(params.limit ?? 50));
    const q = params.q?.trim();
    if (q) search.set('q', q);
    const body = await apiFetch(`/api/customers?${search.toString()}`);
    return parseCustomerList(body);
  };

  if (params.skipCache) {
    return { ...(await load()), fromCache: false };
  }
  return withOfflineCache(CACHE_KEYS.customers, load);
}

export async function getCustomer(id: string): Promise<Customer> {
  const body = await apiFetch(`/api/customers/${encodeURIComponent(id)}`);
  const customer = parseCustomer(unwrapData(body));
  if (!customer) throw new Error('Invalid customer response');
  return customer;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const body = await apiFetch('/api/customers', {
    method: 'POST',
    body: {
      name: input.name,
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      marketing_consent: input.marketing_consent === true,
      sms_consent: input.sms_consent === true,
    },
  });
  const customer = parseCustomer(unwrapData(body));
  if (!customer) throw new Error('Invalid create-customer response');
  return customer;
}

export function customerTitle(customer: Customer | LeadCustomerSummary): string {
  if (customer.name) return customer.name;
  if (customer.email) return customer.email;
  if (customer.phone) return customer.phone;
  return 'Customer';
}
