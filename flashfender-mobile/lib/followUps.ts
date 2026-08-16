import { apiFetch } from '@/lib/api';
import { asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type {
  FollowUp,
  FollowUpListResult,
  LeadCustomerSummary,
  PatchFollowUpInput,
} from '@/lib/types';

function parseCustomerSummary(value: unknown): LeadCustomerSummary | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    name: asString(value.name),
    email: asString(value.email),
    phone: asString(value.phone),
  };
}

export function parseFollowUp(value: unknown): FollowUp | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    title: asString(value.title),
    status: asString(value.status),
    priority: asString(value.priority),
    follow_up_date: asString(value.follow_up_date),
    notes: asString(value.notes) ?? asString(value.description),
    customer: parseCustomerSummary(value.customer),
  };
}

export function parseFollowUpList(body: unknown): FollowUpListResult {
  const { raw, count } = listPayload(body);
  const followUps: FollowUp[] = [];
  for (const item of raw) {
    const followUp = parseFollowUp(item);
    if (followUp) followUps.push(followUp);
  }
  return { followUps, count };
}

function startOfLocalDayIso(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return d.toISOString();
}

function endOfLocalDayIso(date: Date): string {
  const d = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
  return d.toISOString();
}

export type ListFollowUpsParams = {
  limit?: number;
  todayOnly?: boolean;
};

export async function listFollowUps(
  params: ListFollowUpsParams = {},
): Promise<FollowUpListResult> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 20));
  if (params.todayOnly) {
    const now = new Date();
    search.set('follow_up_date_from', startOfLocalDayIso(now));
    search.set('follow_up_date_to', endOfLocalDayIso(now));
  }
  const body = await apiFetch(`/api/follow-ups?${search.toString()}`);
  return parseFollowUpList(body);
}

export function followUpTitle(followUp: FollowUp): string {
  if (followUp.title) return followUp.title;
  if (followUp.customer?.name) return `Follow-up · ${followUp.customer.name}`;
  return 'Follow-up';
}

/** PATCH /api/follow-ups/:id — Complete uses status; Snooze uses follow_up_date. */
export async function patchFollowUp(
  id: string,
  input: PatchFollowUpInput,
): Promise<FollowUp> {
  const body = await apiFetch(`/api/follow-ups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.follow_up_date ? { follow_up_date: input.follow_up_date } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  const followUp = parseFollowUp(unwrapData(body));
  if (!followUp) throw new Error('Invalid follow-up update response');
  return followUp;
}

export function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
