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
import { createDeal } from '@/lib/deals';
import { errorMessage } from '@/lib/errors';
import type { Customer, Deal, Vehicle } from '@/lib/types';
import { listVehicles, vehicleTitle } from '@/lib/vehicles';

type AddDealSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (deal: Deal) => void;
  onForbidden: () => void;
};

export function AddDealSheet({
  visible,
  onClose,
  onCreated,
  onForbidden,
}: AddDealSheetProps) {
  const { tokens, palette } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingPickers, setLoadingPickers] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoadingPickers(true);
    setError(null);
    void Promise.all([
      listVehicles({ status: 'Active', limit: 40, skipCache: true }),
      listCustomers({ limit: 40, skipCache: true }),
    ])
      .then(([vehicleResult, customerResult]) => {
        if (cancelled) return;
        setVehicles(vehicleResult.vehicles);
        setCustomers(customerResult.customers);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingPickers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function reset(): void {
    setVehicleId(null);
    setCustomerId(null);
    setSalePrice('');
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
    if (!vehicleId) {
      setError('Missing required field: vehicle_id');
      return;
    }
    const sale_price = Number(salePrice.trim());
    if (!Number.isFinite(sale_price) || sale_price <= 0) {
      setError('Missing required field: sale_price (must be > 0)');
      return;
    }
    setBusy(true);
    try {
      const deal = await createDeal({
        vehicle_id: vehicleId,
        sale_price,
        customer_id: customerId ?? undefined,
        notes: notes.trim().length > 0 ? notes.trim() : undefined,
      });
      reset();
      onCreated(deal);
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
              <Text style={[styles.title, { color: tokens.text }]}>Add deal</Text>
              <Text style={[styles.hint, { color: tokens.textMuted }]}>
                Pick a vehicle and sale price. Customer is optional for cash /
                walk-in.
              </Text>

              {loadingPickers ? (
                <ActivityIndicator color={palette.primary} style={styles.loader} />
              ) : (
                <>
                  <Text style={[styles.label, { color: tokens.textMuted }]}>
                    Vehicle (required)
                  </Text>
                  {vehicles.length === 0 ? (
                    <Text style={[styles.hint, { color: tokens.textMuted }]}>
                      No active vehicles available. Add stock first.
                    </Text>
                  ) : (
                    <View style={styles.chips}>
                      {vehicles.map((v) => {
                        const selected = vehicleId === v.id;
                        return (
                          <Pressable
                            key={v.id}
                            onPress={() => setVehicleId(v.id)}
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
                              {vehicleTitle(v)}
                              {v.stock_number ? ` · ${v.stock_number}` : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  <Text style={[styles.label, { color: tokens.textMuted }]}>
                    Customer (optional)
                  </Text>
                  <View style={styles.chips}>
                    <Pressable
                      onPress={() => setCustomerId(null)}
                      style={[
                        styles.chip,
                        {
                          borderColor:
                            customerId === null ? tokens.text : tokens.border,
                          backgroundColor:
                            customerId === null
                              ? tokens.background
                              : tokens.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.chipLabel, { color: tokens.text }]}>
                        None
                      </Text>
                    </Pressable>
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
                </>
              )}

              <Text style={[styles.label, { color: tokens.textMuted }]}>
                Sale price
              </Text>
              <TextInput
                value={salePrice}
                onChangeText={setSalePrice}
                keyboardType="decimal-pad"
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
                label={busy ? 'Saving…' : 'Create deal'}
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
