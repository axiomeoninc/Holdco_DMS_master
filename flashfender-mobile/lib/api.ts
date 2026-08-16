import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/storage';

const DEFAULT_API_URL = 'https://app.flashfender.com';

const SKIP_REFRESH_PATHS = new Set([
  '/api/auth/mobile/login',
  '/api/auth/mobile/refresh',
  '/api/auth/mobile/logout',
]);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiFetchOptions = {
  method?: ApiMethod;
  body?: unknown;
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
  return raw.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function codeFromBody(body: unknown): string | null {
  if (isRecord(body) && typeof body.code === 'string' && body.code.length > 0) {
    return body.code;
  }
  return null;
}

function messageFromBody(status: number, body: unknown): string {
  if (isRecord(body)) {
    if (typeof body.error === 'string' && body.error.length > 0) return body.error;
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  }
  return `Request failed (${status})`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.warn('API response was not JSON', err);
    return null;
  }
}

/**
 * Cookie-first mobile refresh. Login JSON does not include refresh_token;
 * the HttpOnly cookie (credentials: include) is the primary refresh credential.
 */
async function tryRefreshAccessToken(): Promise<boolean> {
  const url = `${getApiBaseUrl()}/api/auth/mobile/refresh`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const body = await readJson(response);
  if (!response.ok) {
    await clearAccessToken();
    return false;
  }

  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(data) || typeof data.access_token !== 'string') {
    await clearAccessToken();
    return false;
  }

  await setAccessToken(data.access_token);
  return true;
}

/**
 * JSON fetch to the FlashFender API.
 * Always uses credentials: "include" so the RN cookie jar (and web) can store
 * HttpOnly refresh cookies. Attaches Bearer access token when present.
 */
export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<unknown> {
  const method = opts.method ?? 'GET';
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!opts.skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    console.warn('Network request failed', err);
    throw new ApiError(
      0,
      'Could not reach the dealership. Check your connection and try again.',
    );
  }

  const shouldRefresh =
    response.status === 401 &&
    !opts.skipRefresh &&
    !opts.skipAuth &&
    !SKIP_REFRESH_PATHS.has(path);

  if (shouldRefresh) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiFetch(path, { ...opts, skipRefresh: true });
    }
    await clearAccessToken();
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFromBody(response.status, body),
      codeFromBody(body),
    );
  }
  return body;
}
