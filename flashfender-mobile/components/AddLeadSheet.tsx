import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FormSheet } from '@/components/FormSheet';
import { ErrorBanner, GoldButton, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { customerTitle, listCustomers } from '@/lib/customers';
import { errorMessage } from '@/lib/errors';
import { createLead } from '@/lib/leads';
import type { Customer, Lead, LeadSource } from '@/lib/types';
import { LEAD_SOURCES } from '@/lib/types';

type AddLeadSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (lead: Lead) => void;
  onForbidden: () => void;
};

export function AddLeadSheet({
  visible,
  onClose,
  onCreated,
  onForbidden,
}: AddLeadSheetProps) {
  const { tokens, palette } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [source, setSource] = useState<LeadSource>('Walk-in');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoadingCustomers(true);
    setError(null);
    void listCustomers({ limit: 40, skipCache: true })
      .then((result) => {
        if (cancelled) return;
        setCustomers(result.customers);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function reset(): void {
    setCustomerId(null);
    setSource('Walk-in');
    setNotes('');
    setError(null);
    setBusy(false);
  }

  function close(): void {
    reset();
    onClose();
  }

  async function onSubmit(): Promise<void> {
    setError(null);
    if (!customerId) {
      setError('customer_id is required. Pick a customer.');
      return;
    }
    setBusy(true);
    try {
      const lead = await createLead({
        customer_id: customerId,
        source,
        notes: notes.trim().length > 0 ? notes.trim() : undefined,
      });
      reset();
      onCreated(lead);
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
              <Text style={[styles.title, { color: tokens.text }]}>Add lead</Text>
              <Text style={[styles.hint, { color: tokens.textMuted }]}>
                Link a customer and source. Errors from the desk are shown as-is.
              </Text>

              <Text style={[styles.label, { color: tokens.textMuted }]}>
                Customer (required)
              </Text>
              {loadingCustomers ? (
                <ActivityIndicator color={palette.primary} style={styles.loader} />
              ) : customers.length === 0 ? (
                <Text style={[styles.hint, { color: tokens.textMuted }]}>
                  No customers returned. Create a customer in People first.
                </Text>
              ) : (
                <View style={styles.chips}>
                  {customers.map((c) => {
                    const selected = customerId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCustomerId(c.id)}
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? tokens.text : tokens.border,
                            backgroundColor: selected
                              ? tokens.background
                              : tokens.surface,
                          },
                        ]}
                      >
                        <Text style={[styles.chipLabel, { color: tokens.text }]}>
                          {customerTitle(c)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.label, { color: tokens.textMuted }]}>Source</Text>
              <View style={styles.chips}>
                {LEAD_SOURCES.map((item) => {
                  const selected = source === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setSource(item)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? tokens.text : tokens.border,
                          backgroundColor: selected
                            ? tokens.background
                            : tokens.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.chipLabel, { color: tokens.text }]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: tokens.textMuted }]}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor={tokens.textMuted}
                style={[
                  styles.input,
                  styles.notes,
                  {
                    color: tokens.text,
                    backgroundColor: tokens.background,
                    borderColor: tokens.border,
                  },
                ]}
              />

              {error ? (
                <View style={styles.errorWrap}>
                  <ErrorBanner message={error} />
                </View>
              ) : null}

              <GoldButton
                label={busy ? 'Saving…' : 'Create lead'}
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
  loader: {
    marginBottom: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  notes: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorWrap: {
    marginBottom: 14,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelLabel: {
    fontSize: 15,
  },
});
