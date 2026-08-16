import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ff_access_token';
const BIOMETRIC_ENABLED_KEY = 'ff_biometric_enabled';
const BIOMETRIC_FLAG_KEY = 'ff_biometric_after_login';
const NOTIFICATION_STATUS_KEY = 'ff_notification_status';
const NOTIFICATION_REASON_KEY = 'ff_notification_reason';

export type NotificationStatus = 'enabled' | 'not_enabled' | 'unsupported' | 'unknown';

async function webGet(key: string): Promise<string | null> {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function webSet(key: string, value: string | null): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (err) {
    console.warn('Web storage write failed', err);
  }
}

async function storeGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webGet(key);
  return SecureStore.getItemAsync(key);
}

async function storeSet(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    await webSet(key, value);
    return;
  }
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getAccessToken(): Promise<string | null> {
  return storeGet(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await storeSet(ACCESS_TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  await storeSet(ACCESS_TOKEN_KEY, null);
}

/** User preference: require biometrics on cold start when a token exists. */
export async function getBiometricEnabled(): Promise<boolean | null> {
  const raw = await storeGet(BIOMETRIC_ENABLED_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await storeSet(BIOMETRIC_ENABLED_KEY, enabled ? '1' : '0');
}

/**
 * Set after a successful password login so the next cold start knows to gate.
 * Cleared on sign-out.
 */
export async function markBiometricSessionFlag(): Promise<void> {
  await storeSet(BIOMETRIC_FLAG_KEY, '1');
}

export async function clearBiometricSessionFlag(): Promise<void> {
  await storeSet(BIOMETRIC_FLAG_KEY, null);
}

export async function hasBiometricSessionFlag(): Promise<boolean> {
  const raw = await storeGet(BIOMETRIC_FLAG_KEY);
  return raw === '1';
}

export async function getNotificationStatus(): Promise<NotificationStatus> {
  const raw = await storeGet(NOTIFICATION_STATUS_KEY);
  if (
    raw === 'enabled' ||
    raw === 'not_enabled' ||
    raw === 'unsupported' ||
    raw === 'unknown'
  ) {
    return raw;
  }
  return 'unknown';
}

export async function setNotificationStatus(
  status: NotificationStatus,
): Promise<void> {
  await storeSet(NOTIFICATION_STATUS_KEY, status);
}

export async function getNotificationReason(): Promise<string | null> {
  return storeGet(NOTIFICATION_REASON_KEY);
}

export async function setNotificationReason(reason: string | null): Promise<void> {
  await storeSet(NOTIFICATION_REASON_KEY, reason);
}
