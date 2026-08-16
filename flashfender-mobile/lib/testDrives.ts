import { apiFetch } from '@/lib/api';
import { asFiniteNumber, asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type {
  LeadCustomerSummary,
  TestDrive,
  TestDriveListResult,
  TestDriveVehicleSummary,
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

function parseVehicleSummary(value: unknown): TestDriveVehicleSummary | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    year: asFiniteNumber(value.year),
    make: asString(value.make),
    model: asString(value.model),
    vin: asString(value.vin),
    stock_number: asString(value.stock_number),
  };
}

export function parseTestDrive(value: unknown): TestDrive | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    status: asString(value.status),
    outcome: asString(value.outcome),
    notes: asString(value.notes),
    scheduled_date: asString(value.scheduled_date) ?? asString(value.scheduled_at),
    start_time: asString(value.start_time),
    end_time: asString(value.end_time),
    customer: parseCustomerSummary(value.customer),
    vehicle: parseVehicleSummary(value.vehicle),
  };
}

export function parseTestDriveList(body: unknown): TestDriveListResult {
  const { raw, count } = listPayload(body);
  const testDrives: TestDrive[] = [];
  for (const item of raw) {
    const row = parseTestDrive(item);
    if (row) testDrives.push(row);
  }
  return { testDrives, count };
}

export async function listTestDrives(limit = 50): Promise<TestDriveListResult> {
  const body = await apiFetch(`/api/test-drives?limit=${limit}`);
  return parseTestDriveList(body);
}

export async function getTestDrive(id: string): Promise<TestDrive> {
  const body = await apiFetch(`/api/test-drives/${encodeURIComponent(id)}`);
  const row = parseTestDrive(unwrapData(body));
  if (!row) throw new Error('Invalid test drive response');
  return row;
}

export function testDriveTitle(drive: TestDrive): string {
  if (drive.customer?.name) return drive.customer.name;
  if (drive.vehicle?.make || drive.vehicle?.model) {
    const parts = [
      drive.vehicle.year !== null ? String(drive.vehicle.year) : null,
      drive.vehicle.make,
      drive.vehicle.model,
    ].filter((part): part is string => part !== null);
    if (parts.length > 0) return parts.join(' ');
  }
  return 'Test drive';
}

export function testDriveWhen(drive: TestDrive): string {
  const raw = drive.start_time ?? drive.scheduled_date;
  if (!raw) return 'No time set';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function startTestDrive(id: string): Promise<TestDrive> {
  const body = await apiFetch(`/api/test-drives/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      status: 'In Progress',
      start_time: new Date().toISOString(),
    },
  });
  const row = parseTestDrive(unwrapData(body));
  if (!row) throw new Error('Invalid test drive update response');
  return row;
}

export async function completeTestDrive(id: string): Promise<TestDrive> {
  const body = await apiFetch(`/api/test-drives/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      status: 'Completed',
      end_time: new Date().toISOString(),
    },
  });
  const row = parseTestDrive(unwrapData(body));
  if (!row) throw new Error('Invalid test drive update response');
  return row;
}
