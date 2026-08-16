import { ApiError, apiFetch } from '@/lib/api';
import { clearAccessToken, setAccessToken } from '@/lib/storage';
import type { LoginSuccess, MobileUser } from '@/lib/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUser(value: unknown): MobileUser {
  if (!isRecord(value)) {
    throw new Error('Session payload missing user');
  }
  const id = value.id;
  const email = value.email;
  if (typeof id !== 'string' || typeof email !== 'string') {
    throw new Error('User is missing id or email');
  }
  return {
    id,
    email,
    full_name: typeof value.full_name === 'string' ? value.full_name : null,
    role: typeof value.role === 'string' ? value.role : null,
    dealership_id: typeof value.dealership_id === 'string' ? value.dealership_id : null,
  };
}

function unwrapData(body: unknown): unknown {
  if (isRecord(body) && 'data' in body) return body.data;
  return body;
}

export function parseLoginResponse(body: unknown): LoginSuccess {
  const data = unwrapData(body);
  if (!isRecord(data)) {
    throw new Error('Invalid login response');
  }
  const token = data.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Login response missing access_token');
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : null;
  return {
    accessToken: token,
    expiresIn,
    user: parseUser(data.user),
  };
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginSuccess> {
  try {
    const body = await apiFetch('/api/auth/mobile/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
      skipRefresh: true,
    });
    const result = parseLoginResponse(body);
    await setAccessToken(result.accessToken);
    return result;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new ApiError(
        404,
        'Mobile login is not live yet (404). This app does not fall back to web /api/auth/login.',
        err.code,
      );
    }
    throw err;
  }
}

export async function fetchCurrentUser(): Promise<MobileUser> {
  const body = await apiFetch('/api/me');
  const data = unwrapData(body);
  if (isRecord(data) && isRecord(data.user)) {
    return parseUser(data.user);
  }
  return parseUser(data);
}

export async function logoutRemote(): Promise<void> {
  try {
    await apiFetch('/api/auth/mobile/logout', {
      method: 'POST',
      skipRefresh: true,
    });
  } catch (err) {
    console.warn('Remote logout failed; clearing local session anyway', err);
  } finally {
    await clearAccessToken();
  }
}
