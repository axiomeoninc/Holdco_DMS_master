/**
 * Service module — shared types + helpers.
 *
 * Honest design: service reactivation candidates are INFORMATIONAL ONLY. They
 * are surfaced to the dealership desk based on last-service age AND the
 * customer's service-contact consent. Nothing here sends anything.
 */

export const SERVICE_TYPES = [
  "oil_change",
  "maintenance",
  "repair",
  "tire",
  "brake",
  "inspection",
  "recall",
  "detail",
  "warranty",
  "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_STATUSES = [
  "completed",
  "in_progress",
  "scheduled",
  "cancelled",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type ServiceRecord = {
  id: string;
  dealership_id: string | null;
  location_id: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  service_date: string;
  odometer: number | null;
  service_type: ServiceType;
  status: ServiceStatus;
  notes: string | null;
  cost: number | null;
  performed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; name: string; email: string | null; phone: string | null } | null;
  vehicle?: {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    image_gallery: string[] | null;
    images?: string | string[] | null;
  } | null;
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  oil_change: "Oil change",
  maintenance: "Maintenance",
  repair: "Repair",
  tire: "Tire",
  brake: "Brake",
  inspection: "Inspection",
  recall: "Recall",
  detail: "Detail",
  warranty: "Warranty",
  other: "Other",
};

/** Default days without service before a customer becomes a reactivation candidate. */
export const DEFAULT_REACTIVATION_DAYS = 180;

/**
 * A service reactivation candidate. Informational: surfaced to the desk only
 * when the customer has given service-contact consent.
 */
export type ServiceReactivationCandidate = {
  customer_id: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  last_service_date: string;
  last_service_type: ServiceType | null;
  last_vehicle_label: string | null;
  days_since_last_service: number;
  service_contact_consent: boolean;
};

/** Compute days since last service from an ISO date string. */
export function daysSinceService(isoDate: string, nowMs = Date.now()): number {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / (1000 * 60 * 60 * 24)));
}

/**
 * Build reactivation candidates from service history rows (customer-scoped).
 * Only customers with service_contact_consent === true and last service older
 * than `thresholdDays` are included — informational only.
 */
export function buildReactivationCandidates(
  rows: Array<{
    service_date: string;
    service_type: ServiceType | null;
    customer_id: string;
    customer_name: string;
    email: string | null;
    phone: string | null;
    service_contact_consent: boolean;
    vehicle_label: string | null;
  }>,
  opts: { thresholdDays?: number; nowMs?: number } = {}
): ServiceReactivationCandidate[] {
  const thresholdDays = opts.thresholdDays ?? DEFAULT_REACTIVATION_DAYS;
  const nowMs = opts.nowMs ?? Date.now();

  // Latest service per customer.
  const byCustomer = new Map<
    string,
    (typeof rows)[number]
  >();
  for (const row of rows) {
    const existing = byCustomer.get(row.customer_id);
    if (!existing || row.service_date > existing.service_date) {
      byCustomer.set(row.customer_id, row);
    }
  }

  const candidates: ServiceReactivationCandidate[] = [];
  for (const row of byCustomer.values()) {
    if (!row.service_contact_consent) continue;
    const days = daysSinceService(row.service_date, nowMs);
    if (days < thresholdDays) continue;
    candidates.push({
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      email: row.email,
      phone: row.phone,
      last_service_date: row.service_date,
      last_service_type: row.service_type,
      last_vehicle_label: row.vehicle_label,
      days_since_last_service: days,
      service_contact_consent: true,
    });
  }

  return candidates.sort(
    (a, b) => b.days_since_last_service - a.days_since_last_service
  );
}
