import { apiFetch } from '@/lib/api';
import { asFiniteNumber, asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type {
  CreditApplication,
  CreditApplicationListResult,
  DealVehicleSummary,
  LeadCustomerSummary,
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

export function parseCreditApplication(value: unknown): CreditApplication | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    status: asString(value.status),
    first_name: asString(value.first_name),
    last_name: asString(value.last_name),
    created_at: asString(value.created_at),
    customer: parseCustomerSummary(value.customer),
    vehicle: parseVehicleSummary(value.vehicle),
  };
}

export function parseCreditApplicationList(body: unknown): CreditApplicationListResult {
  const { raw, count } = listPayload(body);
  const applications: CreditApplication[] = [];
  for (const item of raw) {
    const app = parseCreditApplication(item);
    if (app) applications.push(app);
  }
  return { applications, count };
}

export async function listCreditApplications(
  limit = 50,
): Promise<CreditApplicationListResult> {
  const body = await apiFetch(`/api/crm/credit-applications?limit=${limit}`);
  return parseCreditApplicationList(body);
}

export async function getCreditApplication(id: string): Promise<CreditApplication> {
  const body = await apiFetch(
    `/api/crm/credit-applications/${encodeURIComponent(id)}`,
  );
  const app = parseCreditApplication(unwrapData(body));
  if (!app) throw new Error('Invalid credit application response');
  return app;
}

export function creditApplicationTitle(app: CreditApplication): string {
  const name = [app.first_name, app.last_name].filter(Boolean).join(' ');
  if (name.length > 0) return name;
  if (app.customer?.name) return app.customer.name;
  return 'Credit application';
}
