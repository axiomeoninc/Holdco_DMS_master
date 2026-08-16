import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FormSheet } from '@/components/FormSheet';
import { ErrorBanner, GoldButton, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { createVehicle, errorMessage } from '@/lib/vehicles';
import type { CreateVehicleInput, Vehicle } from '@/lib/types';

const CONDITIONS = ['Used', 'New'] as const;

type AddVehicleSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (vehicle: Vehicle) => void;
  onForbidden: () => void;
};

export function AddVehicleSheet({
  visible,
  onClose,
  onCreated,
  onForbidden,
}: AddVehicleSheetProps) {
  const { tokens } = useTheme();
  const [vin, setVin] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>('Used');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setVin('');
    setYear('');
    setMake('');
    setModel('');
    setCondition('Used');
    setPurchasePrice('');
    setRetailPrice('');
    setError(null);
    setBusy(false);
  }

  function close(): void {
    reset();
    onClose();
  }

  async function onSubmit(): Promise<void> {
    setError(null);
    const parsed = parseForm({
      vin,
      year,
      make,
      model,
      condition,
      purchasePrice,
      retailPrice,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const vehicle = await createVehicle(parsed.input);
      reset();
      onCreated(vehicle);
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
              <Text style={[styles.title, { color: tokens.text }]}>Add vehicle</Text>
              <Text style={[styles.hint, { color: tokens.textMuted }]}>
                POST /api/vehicles requires VIN, year, make, model, condition, and
                both prices. Nothing is saved unless the server accepts the row.
              </Text>

              <Field
                label="VIN"
                value={vin}
                onChangeText={(t) => setVin(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Field
                label="Year"
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
              />
              <Field label="Make" value={make} onChangeText={setMake} />
              <Field label="Model" value={model} onChangeText={setModel} />

              <Text style={[styles.label, { color: tokens.textMuted }]}>Condition</Text>
              <View style={styles.chips}>
                {CONDITIONS.map((item) => {
                  const selected = condition === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCondition(item)}
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

              <Field
                label="Purchase price"
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                keyboardType="decimal-pad"
              />
              <Field
                label="Retail price"
                value={retailPrice}
                onChangeText={setRetailPrice}
                keyboardType="decimal-pad"
              />

              {error ? (
                <View style={styles.errorWrap}>
                  <ErrorBanner message={error} />
                </View>
              ) : null}

              <GoldButton
                label={busy ? 'Saving…' : 'Create vehicle'}
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
  autoCorrect,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'characters' | 'none' | 'words';
  autoCorrect?: boolean;
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
        autoCorrect={autoCorrect}
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

function parseForm(fields: {
  vin: string;
  year: string;
  make: string;
  model: string;
  condition: string;
  purchasePrice: string;
  retailPrice: string;
}): { ok: true; input: CreateVehicleInput } | { ok: false; error: string } {
  const vin = fields.vin.trim();
  const make = fields.make.trim();
  const model = fields.model.trim();
  const year = Number(fields.year.trim());
  const purchase_price = Number(fields.purchasePrice.trim());
  const retail_price = Number(fields.retailPrice.trim());

  if (vin.length === 0 || make.length === 0 || model.length === 0) {
    return { ok: false, error: 'VIN, year, make, and model are required.' };
  }
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { ok: false, error: 'Year must be a valid number.' };
  }
  if (!Number.isFinite(purchase_price) || purchase_price < 0) {
    return { ok: false, error: 'Purchase price must be a number.' };
  }
  if (!Number.isFinite(retail_price) || retail_price < 0) {
    return { ok: false, error: 'Retail price must be a number.' };
  }
  return {
    ok: true,
    input: {
      vin,
      year,
      make,
      model,
      condition: fields.condition,
      purchase_price,
      retail_price,
    },
  };
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
  chips: {
    flexDirection: 'row',
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
