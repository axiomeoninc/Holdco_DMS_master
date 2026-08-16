import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricCapability = {
  available: boolean;
  hasHardware: boolean;
  enrolled: boolean;
};

/** Web and environments without LA always report unavailable (graceful skip). */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return { available: false, hasHardware: false, enrolled: false };
  }
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware
      ? await LocalAuthentication.isEnrolledAsync()
      : false;
    return {
      available: hasHardware && enrolled,
      hasHardware,
      enrolled,
    };
  } catch (err) {
    console.warn('Biometric capability check failed', err);
    return { available: false, hasHardware: false, enrolled: false };
  }
}

export async function promptBiometricUnlock(
  promptMessage = 'Unlock FlashFender',
): Promise<'success' | 'failed' | 'unavailable'> {
  const capability = await getBiometricCapability();
  if (!capability.available) return 'unavailable';

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
    });
    return result.success ? 'success' : 'failed';
  } catch (err) {
    console.warn('Biometric prompt failed', err);
    return 'failed';
  }
}
