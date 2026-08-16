import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';

import { apiFetch } from '@/lib/api';
import {
  getNotificationStatus,
  setNotificationReason,
  setNotificationStatus,
  type NotificationStatus,
} from '@/lib/storage';

export type { NotificationStatus };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolveProjectId(): string | undefined {
  const easId = Constants.easConfig?.projectId;
  if (typeof easId === 'string' && easId.length > 0) return easId;
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const fromExtra = extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hrefFromPushData(data: unknown): Href | null {
  if (!isRecord(data)) return null;
  const path = typeof data.path === 'string' ? data.path : null;
  if (path && path.startsWith('/')) return path as Href;
  const type = typeof data.type === 'string' ? data.type : null;
  const id = typeof data.id === 'string' ? data.id : null;
  if (type === 'lead' && id) return `/lead/${id}`;
  if (type === 'invoice' && id) return `/invoice/${id}`;
  if (type === 'ticket' && id) return `/ticket/${id}`;
  if (type === 'vehicle' && id) return `/vehicle/${id}`;
  if (type === 'test_drive' && id) return `/test-drive/${id}`;
  if (type === 'deal' && id) return `/deal/${id}`;
  if (type === 'customer' && id) return `/customer/${id}`;
  if (type === 'follow_up') return '/follow-ups';
  if (type === 'task') return '/tasks';
  return null;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'FlashFender',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00AEEF',
  });
}

export function subscribePushNavigation(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const href = hrefFromPushData(response.notification.request.content.data);
    if (href) {
      router.push(href);
    }
  });
  return () => sub.remove();
}

/**
 * Request permission and register Expo push token with the API.
 * Silent no-op on web. Failures are stored so Settings can explain why.
 */
export async function registerPushTokenIfPossible(): Promise<NotificationStatus> {
  if (Platform.OS === 'web') {
    await setNotificationStatus('unsupported');
    await setNotificationReason('Notifications are not supported in the browser.');
    return 'unsupported';
  }

  if (!Device.isDevice) {
    await setNotificationStatus('not_enabled');
    await setNotificationReason(
      'Push needs a physical device. Simulators cannot register.',
    );
    return 'not_enabled';
  }

  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      await setNotificationStatus('not_enabled');
      await setNotificationReason(
        'Notification permission is off. Enable it in system settings.',
      );
      return 'not_enabled';
    }

    const projectId = resolveProjectId();
    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenResult.data;
    if (typeof token !== 'string' || token.length === 0) {
      await setNotificationStatus('not_enabled');
      await setNotificationReason('Expo did not return a push token.');
      return 'not_enabled';
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await apiFetch('/api/auth/mobile/push-token', {
      method: 'POST',
      body: { token, platform },
    });

    await setNotificationStatus('enabled');
    await setNotificationReason(null);
    return 'enabled';
  } catch (err) {
    const message =
      err instanceof Error && err.message.length > 0
        ? err.message
        : 'Push registration failed.';
    console.warn('Push registration failed', message);
    await setNotificationStatus('not_enabled');
    await setNotificationReason(message);
    return 'not_enabled';
  }
}

export async function readStoredNotificationStatus(): Promise<NotificationStatus> {
  return getNotificationStatus();
}
