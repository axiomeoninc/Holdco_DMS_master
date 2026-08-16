import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (err) {
    console.warn('Haptics unavailable', err);
  }
}

export async function hapticError(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (err) {
    console.warn('Haptics unavailable', err);
  }
}
