import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { Screen, useTheme } from '@/components/ui';

export function BiometricLockScreen() {
  const { tokens, palette } = useTheme();
  const { unlockWithBiometrics, fallBackToPasswordLogin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoPrompt = useRef(false);

  const tryUnlock = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithBiometrics();
      if (!ok) {
        setError('Biometric unlock failed. Sign in with your password.');
      }
    } finally {
      setBusy(false);
    }
  }, [unlockWithBiometrics]);

  useEffect(() => {
    if (didAutoPrompt.current) return;
    didAutoPrompt.current = true;
    void tryUnlock();
  }, [tryUnlock]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <Text style={[styles.brand, { color: palette.primary }]}>FlashFender</Text>
        <Text style={[styles.title, { color: tokens.text }]}>Unlock</Text>
        <Text style={[styles.hint, { color: tokens.textMuted }]}>
          Use Face ID or device biometrics to continue. If unavailable, sign in
          again with your password.
        </Text>

        {error ? (
          <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text>
        ) : null}

        {busy ? (
          <ActivityIndicator color={palette.primary} style={styles.spinner} />
        ) : (
          <Pressable
            onPress={() => {
              void tryUnlock();
            }}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: pressed
                  ? palette.primaryPressed
                  : palette.primary,
              },
            ]}
          >
            <Text style={styles.primaryLabel}>Try biometrics again</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            void fallBackToPasswordLogin();
          }}
          style={({ pressed }) => [
            styles.secondary,
            {
              borderColor: tokens.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: tokens.text }]}>
            Use password instead
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 8,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  spinner: {
    marginVertical: 16,
  },
  primary: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
