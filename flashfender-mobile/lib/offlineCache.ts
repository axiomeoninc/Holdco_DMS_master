import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '@/lib/api';

const PREFIX = 'ff_cache:';

export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (raw === null || raw.length === 0) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore; next online fetch still works.
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}

/**
 * Run a GET-style loader; on network failure return the last successful payload
 * with `fromCache: true`. Mutations must not use this.
 */
export async function withOfflineCache<T extends object>(
  key: string,
  load: () => Promise<T>,
): Promise<T & { fromCache: boolean }> {
  try {
    const fresh = await load();
    const { fromCache: _drop, ...toStore } = fresh as T & { fromCache?: boolean };
    void _drop;
    await writeCache(key, toStore);
    return { ...fresh, fromCache: false };
  } catch (err) {
    if (isNetworkError(err)) {
      const cached = await readCache<T>(key);
      if (cached !== null) {
        return { ...cached, fromCache: true };
      }
    }
    throw err;
  }
}

export const CACHE_KEYS = {
  stock: 'list:stock',
  leads: 'list:leads',
  customers: 'list:customers',
  homeKpis: 'home:kpis',
} as const;
