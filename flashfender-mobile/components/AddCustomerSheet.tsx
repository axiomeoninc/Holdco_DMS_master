import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FormSheet } from '@/components/FormSheet';
import { ErrorBanner, GoldButton, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { createCustomer } from '@/lib/customers';
import { errorMessage } from '@/lib/errors';
import type { Customer } from '@/lib/types';

type AddCustomerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
  onForbidden: () => void;
};

export function AddCustomerSheet({
  visible,
  onClose,
  onCreated,
  onForbidden,
}: AddCustomerSheetProps) {
  const { tokens } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setName('');
    setEmail('');
    setPhone('');
    setMarketingConsent(false);
    setSmsConsent(false);
    setError(null);
    setBusy(false);
  }

  function close(): void {
    reset();
    onClose();
  }

  async function onSubmit(): Promise<void> {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Missing required field: name');
      return;
    }
    setBusy(true);
    try {
      const customer = await createCustomer({
        name: trimmed,
        email: email.trim().length > 0 ? email.trim() : undefined,
        phone: phone.trim().length > 0 ? phone.trim() : undefined,
        marketing_consent: marketingConsent,
        sms_consent: smsConsent,
      });
      reset();
      onCreated(customer);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        reset();
        onForbidden();
        return;
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet visible={visible} onClose={close}>
              <Text style={[styles.title, { color: tokens.text }]}>Add customer</Text>
              <Text style={[styles.hint, { color: tokens.textMuted }]}>
                Name is required. Marketing and SMS stay off unless you record
                consent.
              </Text>

              <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Field
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <ConsentToggle
                label="Marketing consent (CASL)"
                checked={marketingConsent}
                onToggle={() => setMarketingConsent((v) => !v)}
              />
              <ConsentToggle
                label="SMS consent (CASL)"
                checked={smsConsent}
                onToggle={() => setSmsConsent((v) => !v)}
              />

              {error ? (
                <View style={styles.errorWrap}>
                  <ErrorBanner message={error} />
                </View>
              ) : null}

              <GoldButton
                label={busy ? 'Saving…' : 'Create customer'}
                onPress={() => {
                  void onSubmit();
                }}
                disabled={busy}
              />
              <Pressable onPress={close} style={styles.cancel}>
                <Text style={[styles.cancelLabel, { color: tokens.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
    </FormSheet>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
}) {
  const { tokens } = useTheme();
  return (
    <>
      <Text style={[styles.label, { color: tokens.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholderTextColor={tokens.textMuted}
        style={[
          styles.input,
          {
            color: tokens.text,
            backgroundColor: tokens.background,
            borderColor: tokens.border,
          },
        ]}
      />
    </>
  );
}

function ConsentToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.consentRow,
        {
          borderColor: tokens.border,
          backgroundColor: tokens.background,
        },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: tokens.border,
            backgroundColor: checked ? tokens.text : tokens.surface,
          },
        ]}
      />
      <Text style={[styles.consentLabel, { color: tokens.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  sheetWrap: {
    maxHeight: '92%',
  },
  sheet: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
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
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  consentLabel: {
    fontSize: 14,
    flex: 1,
  },
  errorWrap: {
    marginBottom: 14,
    marginTop: 4,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelLabel: {
    fontSize: 15,
  },
});
