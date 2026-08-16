import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Screen, useTheme } from '@/components/ui';

export default function LoginScreen() {
  const { tokens, palette } = useTheme();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(): Promise<void> {
    setError(null);
    const trimmed = email.trim();
    if (trimmed.length === 0 || password.length === 0) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await signIn(trimmed, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          setError(err.message || 'Email not verified.');
        } else if (err.code === 'TRIAL_EXPIRED' || err.status === 402) {
          setError(err.message || 'Trial expired.');
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Sign in failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={48}
        extraKeyboardSpace={32}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[
          styles.form,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
      >
        <Text style={[styles.brand, { color: palette.primary }]}>FlashFender</Text>
        <Text style={[styles.lede, { color: tokens.text }]}>Dealer sign in</Text>
        <Text style={[styles.hint, { color: tokens.textMuted }]}>
          Use the same email and password as the desk. Your session stays on this
          device.
        </Text>

        <Text style={[styles.label, { color: tokens.textMuted }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="you@dealership.com"
          placeholderTextColor={tokens.textMuted}
          style={[
            styles.input,
            {
              color: tokens.text,
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
            },
          ]}
        />

        <Text style={[styles.label, { color: tokens.textMuted }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          placeholder="Password"
          placeholderTextColor={tokens.textMuted}
          returnKeyType="go"
          onSubmitEditing={() => {
            void onSubmit();
          }}
          style={[
            styles.input,
            {
              color: tokens.text,
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
            },
          ]}
        />

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: tokens.dangerSoft, borderColor: tokens.danger }]}>
            <Text style={[styles.errorText, { color: tokens.danger }]}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            void onSubmit();
          }}
          disabled={busy}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: pressed || busy ? palette.primaryPressed : palette.primary,
              opacity: busy ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.submitLabel}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scroll: {
    flex: 1,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  lede: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  submit: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
