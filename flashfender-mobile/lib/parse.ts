export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

export function unwrapData(body: unknown): unknown {
  if (isRecord(body) && 'data' in body) return body.data;
  return body;
}

export function listPayload(body: unknown): { raw: unknown[]; count: number } {
  if (!isRecord(body)) {
    throw new Error('Invalid list response');
  }
  const raw = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body)
      ? body
      : null;
  if (raw === null) {
    throw new Error('Invalid list response');
  }
  const count = typeof body.count === 'number' ? body.count : raw.length;
  return { raw, count };
}
