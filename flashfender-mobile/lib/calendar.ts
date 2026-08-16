import { apiFetch } from '@/lib/api';
import { asFiniteNumber, asString, isRecord, listPayload } from '@/lib/parse';
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarListResult,
} from '@/lib/types';

function parseDateIso(...candidates: Array<string | null | undefined>): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function vehicleLabel(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const parts = [
    asString(value.year) ??
      (asFiniteNumber(value.year) !== null ? String(asFiniteNumber(value.year)) : null),
    asString(value.make),
    asString(value.model),
  ].filter((part): part is string => part !== null);
  const label = parts.join(' ').trim();
  return label.length > 0 ? label : null;
}

function customerName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return asString(value.name);
}

async function softList(path: string): Promise<unknown[]> {
  try {
    const body = await apiFetch(path);
    return listPayload(body).raw;
  } catch (err) {
    console.warn(`Calendar source failed: ${path}`, err);
    return [];
  }
}

function pushEvent(
  events: CalendarEvent[],
  event: Omit<CalendarEvent, 'dateIso'> & { dateIso: string | null },
): void {
  if (!event.dateIso) return;
  events.push({
    id: event.id,
    type: event.type,
    title: event.title,
    subtitle: event.subtitle,
    dateIso: event.dateIso,
    status: event.status,
    href: event.href,
  });
}

export async function listCalendarEvents(): Promise<CalendarListResult> {
  const [tdRows, fuRows, dealRows, invoiceRows, taskRows] = await Promise.all([
    softList('/api/test-drives?limit=80'),
    softList('/api/follow-ups?limit=80'),
    softList('/api/deals?limit=80'),
    softList('/api/invoices?limit=80&status=Pending'),
    softList('/api/tasks?limit=80'),
  ]);

  const events: CalendarEvent[] = [];

  for (const row of tdRows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    const lead = isRecord(row.lead) ? row.lead : null;
    const leadCustomer = lead ? customerName(lead.customer) : null;
    pushEvent(events, {
      id: `td-${row.id}`,
      type: 'test_drive',
      title: customerName(row.customer) ?? leadCustomer ?? 'Test drive',
      subtitle: vehicleLabel(row.vehicle),
      dateIso: parseDateIso(
        asString(row.scheduled_at),
        asString(row.scheduled_date),
        asString(row.start_time),
      ),
      status: asString(row.status),
      href: `/test-drive/${row.id}`,
    });
  }

  for (const row of fuRows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    pushEvent(events, {
      id: `fu-${row.id}`,
      type: 'follow_up',
      title: customerName(row.customer) ?? asString(row.title) ?? 'Follow-up',
      subtitle: asString(row.notes) ?? asString(row.description),
      dateIso: parseDateIso(asString(row.follow_up_date), asString(row.due_date)),
      status: asString(row.status),
      href: `/follow-ups`,
    });
  }

  for (const row of taskRows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    const assignee = isRecord(row.assigned_user)
      ? asString(row.assigned_user.full_name)
      : null;
    pushEvent(events, {
      id: `task-${row.id}`,
      type: 'appointment',
      title: asString(row.title) ?? 'Task',
      subtitle: assignee ?? asString(row.priority),
      dateIso: parseDateIso(asString(row.due_date), asString(row.reminder_at)),
      status: asString(row.status),
      href: `/tasks`,
    });
  }

  for (const row of dealRows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    const status = (asString(row.deal_status) ?? '').toLowerCase();
    if (!['paid off', 'finance', 'down payment'].includes(status)) continue;
    pushEvent(events, {
      id: `dl-${row.id}`,
      type: 'delivery',
      title: customerName(row.customer) ?? 'Deal delivery',
      subtitle: vehicleLabel(row.vehicle) ?? asString(row.deal_status),
      dateIso: parseDateIso(asString(row.deal_date), asString(row.created_at)),
      status: asString(row.deal_status),
      href: `/deal/${row.id}`,
    });
  }

  for (const row of invoiceRows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    const total = asFiniteNumber(row.total);
    pushEvent(events, {
      id: `inv-${row.id}`,
      type: 'invoice',
      title:
        customerName(row.customer) ?? asString(row.invoice_number) ?? 'Invoice due',
      subtitle:
        total !== null ? `$${total.toLocaleString()}` : asString(row.status),
      dateIso: parseDateIso(
        asString(row.due_date),
        asString(row.invoice_date),
        asString(row.created_at),
      ),
      status: asString(row.status),
      href: `/invoice/${row.id}`,
    });
  }

  events.sort(
    (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime(),
  );

  return { events, count: events.length };
}

export function calendarTypeLabel(type: CalendarEventType): string {
  switch (type) {
    case 'test_drive':
      return 'Test drive';
    case 'follow_up':
      return 'Follow-up';
    case 'delivery':
      return 'Delivery';
    case 'invoice':
      return 'Invoice due';
    case 'appointment':
      return 'Task';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function formatCalendarWhen(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
