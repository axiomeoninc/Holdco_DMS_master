import { Linking } from 'react-native';

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

export async function openTel(phone: string | null | undefined): Promise<void> {
  if (!phone) return;
  const href = `tel:${digitsOnly(phone)}`;
  const can = await Linking.canOpenURL(href);
  if (!can) {
    throw new Error('Calling is not available on this device.');
  }
  await Linking.openURL(href);
}

export async function openSms(phone: string | null | undefined): Promise<void> {
  if (!phone) return;
  const href = `sms:${digitsOnly(phone)}`;
  const can = await Linking.canOpenURL(href);
  if (!can) {
    throw new Error('Messaging is not available on this device.');
  }
  await Linking.openURL(href);
}

export async function openMaps(query: string | null | undefined): Promise<void> {
  if (!query || query.trim().length === 0) return;
  const href = `https://maps.google.com/?q=${encodeURIComponent(query.trim())}`;
  await Linking.openURL(href);
}

export async function openMail(email: string | null | undefined): Promise<void> {
  if (!email) return;
  const href = `mailto:${email.trim()}`;
  const can = await Linking.canOpenURL(href);
  if (!can) {
    throw new Error('Email is not available on this device.');
  }
  await Linking.openURL(href);
}
