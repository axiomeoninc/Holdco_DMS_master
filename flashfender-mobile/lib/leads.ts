import { apiFetch } from '@/lib/api';
import { CACHE_KEYS, withOfflineCache } from '@/lib/offlineCache';
import { asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type {
  CreateLeadInput,
  Lead,
  LeadCustomerSummary,
  LeadListResult,
  LeadStatus,
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

export function parseLead(value: unknown): Lead | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    status: asString(value.status),
    source: asString(value.source),
    temperature: asString(value.temperature),
    notes: asString(value.notes),
    created_at: asString(value.created_at),
    customer: parseCustomerSummary(value.customer),
  };
}

export function parseLeadList(body: unknown): LeadListResult {
  const { raw, count } = listPayload(body);
  const leads: Lead[] = [];
  for (const item of raw) {
    const lead = parseLead(item);
    if (lead) leads.push(lead);
  }
  return { leads, count };
}

export type ListLeadsParams = {
  q?: string;
  limit?: number;
  skipCache?: boolean;
};

export async function listLeads(params: ListLeadsParams = {}): Promise<LeadListResult> {
  const load = async (): Promise<LeadListResult> => {
    const search = new URLSearchParams();
    search.set('limit', String(params.limit ?? 50));
    const q = params.q?.trim();
    if (q) search.set('q', q);
    const body = await apiFetch(`/api/leads?${search.toString()}`);
    return parseLeadList(body);
  };

  if (params.skipCache) {
    return { ...(await load()), fromCache: false };
  }
  return withOfflineCache(CACHE_KEYS.leads, load);
}

export async function getLead(id: string): Promise<Lead> {
  const body = await apiFetch(`/api/leads/${encodeURIComponent(id)}`);
  const lead = parseLead(unwrapData(body));
  if (!lead) throw new Error('Invalid lead response');
  return lead;
}

export async function patchLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const body = await apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
  });
  const lead = parseLead(unwrapData(body));
  if (!lead) throw new Error('Invalid lead update response');
  return lead;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const body = await apiFetch('/api/leads', {
    method: 'POST',
    body: {
      customer_id: input.customer_id,
      ...(input.source ? { source: input.source } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.interest_vehicle_id
        ? { interest_vehicle_id: input.interest_vehicle_id }
        : {}),
    },
  });
  const lead = parseLead(unwrapData(body));
  if (!lead) throw new Error('Invalid create-lead response');
  return lead;
}

export function leadTitle(lead: Lead): string {
  if (lead.customer?.name) return lead.customer.name;
  if (lead.customer?.email) return lead.customer.email;
  if (lead.customer?.phone) return lead.customer.phone;
  return 'Lead';
}
