export function formatPriceCad(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(value);
}

export function balanceDue(
  total: number | null,
  amountPaid: number | null,
): number | null {
  if (total === null) return null;
  return Math.max(0, total - (amountPaid ?? 0));
}
