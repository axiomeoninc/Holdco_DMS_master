import { apiFetch, ApiError } from '@/lib/api';
import { asFiniteNumber, asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type { Invoice, InvoiceListResult, LeadCustomerSummary } from '@/lib/types';

function parseCustomerSummary(value: unknown): LeadCustomerSummary | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    name: asString(value.name),
    email: asString(value.email),
    phone: asString(value.phone),
  };
}

export function parseInvoice(value: unknown): Invoice | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    invoice_number: asString(value.invoice_number),
    status: asString(value.status),
    invoice_date: asString(value.invoice_date),
    due_date: asString(value.due_date),
    payment_amount: asFiniteNumber(value.payment_amount),
    tax_amount: asFiniteNumber(value.tax_amount),
    total: asFiniteNumber(value.total),
    amount_paid: asFiniteNumber(value.amount_paid),
    notes: asString(value.notes),
    customer: parseCustomerSummary(value.customer),
  };
}

export function parseInvoiceList(body: unknown): InvoiceListResult {
  const { raw, count } = listPayload(body);
  const invoices: Invoice[] = [];
  for (const item of raw) {
    const invoice = parseInvoice(item);
    if (invoice) invoices.push(invoice);
  }
  return { invoices, count };
}

export async function listInvoices(limit = 50): Promise<InvoiceListResult> {
  const body = await apiFetch(`/api/invoices?limit=${limit}`);
  return parseInvoiceList(body);
}

export async function getInvoice(id: string): Promise<Invoice> {
  const body = await apiFetch(`/api/invoices/${encodeURIComponent(id)}`);
  const invoice = parseInvoice(unwrapData(body));
  if (!invoice) throw new Error('Invalid invoice response');
  return invoice;
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; code: string | null; message: string; forbidden: boolean };

/**
 * POST /api/payments/checkout — never fabricates Stripe success.
 * 409 PAYMENTS_NOT_CONFIGURED is returned honestly.
 */
export async function startInvoiceCheckout(invoiceId: string): Promise<CheckoutResult> {
  try {
    const body = await apiFetch('/api/payments/checkout', {
      method: 'POST',
      body: {
        reference_type: 'invoice',
        reference_id: invoiceId,
        success_path: '/',
        cancel_path: '/',
      },
    });
    const data = isRecord(body) && isRecord(body.data) ? body.data : null;
    const url = data && typeof data.url === 'string' ? data.url : null;
    if (!url) {
      return {
        ok: false,
        code: null,
        message: 'Checkout did not return a URL. No charge was made.',
        forbidden: false,
      };
    }
    return { ok: true, url };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        forbidden: err.status === 403,
      };
    }
    return {
      ok: false,
      code: null,
      message: err instanceof Error ? err.message : 'Checkout failed',
      forbidden: false,
    };
  }
}

export function invoiceTitle(invoice: Invoice): string {
  if (invoice.invoice_number) return invoice.invoice_number;
  return 'Invoice';
}
