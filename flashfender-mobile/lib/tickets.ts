import { apiFetch } from '@/lib/api';
import { asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type {
  Ticket,
  TicketAssigneeSummary,
  TicketListResult,
} from '@/lib/types';

function parseAssignee(value: unknown): TicketAssigneeSummary | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    full_name: asString(value.full_name),
    email: asString(value.email),
  };
}

export function parseTicket(value: unknown): Ticket | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    subject: asString(value.subject) ?? asString(value.title),
    description: asString(value.description),
    status: asString(value.status),
    priority: asString(value.priority),
    created_at: asString(value.created_at),
    assigned_user: parseAssignee(value.assigned_user),
  };
}

export function parseTicketList(body: unknown): TicketListResult {
  const { raw, count } = listPayload(body);
  const tickets: Ticket[] = [];
  for (const item of raw) {
    const ticket = parseTicket(item);
    if (ticket) tickets.push(ticket);
  }
  return { tickets, count };
}

export async function listTickets(limit = 50): Promise<TicketListResult> {
  const body = await apiFetch(`/api/tickets?limit=${limit}`);
  return parseTicketList(body);
}

export async function getTicket(id: string): Promise<Ticket> {
  const body = await apiFetch(`/api/tickets/${encodeURIComponent(id)}`);
  const ticket = parseTicket(unwrapData(body));
  if (!ticket) throw new Error('Invalid ticket response');
  return ticket;
}

export function ticketTitle(ticket: Ticket): string {
  return ticket.subject ?? 'Ticket';
}

export const TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export async function patchTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<Ticket> {
  const body = await apiFetch(`/api/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
  });
  const ticket = parseTicket(unwrapData(body));
  if (!ticket) throw new Error('Invalid ticket update response');
  return ticket;
}
