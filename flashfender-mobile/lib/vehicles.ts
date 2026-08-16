import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { CACHE_KEYS, withOfflineCache } from '@/lib/offlineCache';
import type { CreateVehicleInput, Vehicle, VehicleListResult } from '@/lib/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function parseImageGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length > 0) urls.push(trimmed);
  }
  return urls;
}

export function parseVehicle(value: unknown): Vehicle | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    vin: asString(value.vin),
    year: asFiniteNumber(value.year),
    make: asString(value.make),
    model: asString(value.model),
    trim: asString(value.trim),
    stock_number: asString(value.stock_number),
    status: asString(value.status),
    odometer: asFiniteNumber(value.odometer),
    retail_price: asFiniteNumber(value.retail_price),
    purchase_price: asFiniteNumber(value.purchase_price),
    condition: asString(value.condition),
    known_damage: asBoolean(value.known_damage),
    disclosure: asString(value.disclosure),
    image_gallery: parseImageGallery(value.image_gallery),
  };
}

function unwrapData(body: unknown): unknown {
  if (isRecord(body) && 'data' in body) return body.data;
  return body;
}

export function parseVehicleList(body: unknown): VehicleListResult {
  if (!isRecord(body)) {
    throw new Error('Invalid vehicles response');
  }
  const raw = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body)
      ? body
      : null;
  if (raw === null) {
    throw new Error('Invalid vehicles response');
  }
  const vehicles: Vehicle[] = [];
  for (const item of raw) {
    const vehicle = parseVehicle(item);
    if (vehicle) vehicles.push(vehicle);
  }
  const count = typeof body.count === 'number' ? body.count : vehicles.length;
  return { vehicles, count };
}

export type ListVehiclesParams = {
  q?: string;
  status?: string;
  limit?: number;
  /** When true, do not read/write the shared stock offline cache (e.g. home KPIs). */
  skipCache?: boolean;
};

export async function listVehicles(
  params: ListVehiclesParams = {},
): Promise<VehicleListResult> {
  const load = async (): Promise<VehicleListResult> => {
    const search = new URLSearchParams();
    search.set('limit', String(params.limit ?? 50));
    if (params.status && params.status !== 'All') {
      search.set('status', params.status);
    }
    const q = params.q?.trim();
    if (q) search.set('q', q);
    const body = await apiFetch(`/api/vehicles?${search.toString()}`);
    return parseVehicleList(body);
  };

  if (params.skipCache) {
    return { ...(await load()), fromCache: false };
  }
  return withOfflineCache(CACHE_KEYS.stock, load);
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const body = await apiFetch(`/api/vehicles/${encodeURIComponent(id)}`);
  const vehicle = parseVehicle(unwrapData(body));
  if (!vehicle) {
    throw new Error('Invalid vehicle response');
  }
  return vehicle;
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const body = await apiFetch('/api/vehicles', {
    method: 'POST',
    body: {
      vin: input.vin,
      year: input.year,
      make: input.make,
      model: input.model,
      condition: input.condition,
      purchase_price: input.purchase_price,
      retail_price: input.retail_price,
    },
  });
  const vehicle = parseVehicle(unwrapData(body));
  if (!vehicle) {
    throw new Error('Invalid create-vehicle response');
  }
  return vehicle;
}

export function vehicleTitle(vehicle: Vehicle): string {
  const parts: string[] = [];
  if (vehicle.year !== null) parts.push(String(vehicle.year));
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  return parts.length > 0 ? parts.join(' ') : 'Vehicle';
}

export function formatPriceCad(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(value);
}

export function formatOdometerKm(value: number | null): string {
  if (value === null) return '—';
  return `${new Intl.NumberFormat('en-CA').format(value)} km`;
}

export function resolveImageUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${getApiBaseUrl()}${url}`;
  return url;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.length > 0) return err.message;
  return 'Something went wrong.';
}
