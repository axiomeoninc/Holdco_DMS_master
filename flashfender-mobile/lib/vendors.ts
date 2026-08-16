import { apiFetch } from '@/lib/api';
import { asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type { Vendor, VendorListResult } from '@/lib/types';

export function parseVendor(value: unknown): Vendor | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    vendor_name: asString(value.vendor_name),
    vendor_type: asString(value.vendor_type),
    contact_name: asString(value.contact_name),
    phone: asString(value.phone),
    email: asString(value.email),
    address: asString(value.address),
  };
}

export function parseVendorList(body: unknown): VendorListResult {
  const { raw, count } = listPayload(body);
  const vendors: Vendor[] = [];
  for (const item of raw) {
    const vendor = parseVendor(item);
    if (vendor) vendors.push(vendor);
  }
  return { vendors, count };
}

export async function listVendors(limit = 100): Promise<VendorListResult> {
  const body = await apiFetch(`/api/vendors?limit=${limit}`);
  return parseVendorList(body);
}

export async function getVendor(id: string): Promise<Vendor> {
  const body = await apiFetch(`/api/vendors/${encodeURIComponent(id)}`);
  const vendor = parseVendor(unwrapData(body));
  if (!vendor) throw new Error('Invalid vendor response');
  return vendor;
}

export function vendorTitle(vendor: Vendor): string {
  return vendor.vendor_name ?? 'Vendor';
}
