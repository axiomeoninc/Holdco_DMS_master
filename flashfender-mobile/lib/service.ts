import { apiFetch } from '@/lib/api';
import { asFiniteNumber, asString, isRecord, listPayload } from '@/lib/parse';
import type {
  DealVehicleSummary,
  LeadCustomerSummary,
  ServiceRecord,
  ServiceRecordListResult,
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

export function parseServiceRecord(value: unknown): ServiceRecord | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    service_type: asString(value.service_type),
    status: asString(value.status),
    service_date: asString(value.service_date),
    notes: asString(value.notes),
    customer: parseCustomerSummary(value.customer),
    vehicle: parseVehicleSummary(value.vehicle),
  };
}

export function parseServiceRecordList(body: unknown): ServiceRecordListResult {
  const { raw, count } = listPayload(body);
  const records: ServiceRecord[] = [];
  for (const item of raw) {
    const record = parseServiceRecord(item);
    if (record) records.push(record);
  }
  return { records, count };
}

export async function listServiceRecords(
  limit = 50,
): Promise<ServiceRecordListResult> {
  const body = await apiFetch(`/api/service/records?limit=${limit}`);
  return parseServiceRecordList(body);
}

export function serviceRecordTitle(record: ServiceRecord): string {
  if (record.service_type) return record.service_type;
  if (record.customer?.name) return record.customer.name;
  return 'Service record';
}
