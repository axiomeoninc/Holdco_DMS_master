import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FormSheet } from '@/components/FormSheet';
import { ErrorBanner, GoldButton, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { createExpense, todayIsoDate } from '@/lib/expenses';
import { errorMessage } from '@/lib/errors';
import type { CreateExpenseInput, Expense, ExpenseCategory } from '@/lib/types';
import { EXPENSE_CATEGORIES } from '@/lib/types';

type AddExpenseSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (expense: Expense) => void;
  onForbidden: () => void;
};

export function AddExpenseSheet({
  visible,
  onClose,
  onCreated,
  onForbidden,
}: AddExpenseSheetProps) {
  const { tokens } = useTheme();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Miscellaneous');
  const [expenseDate, setExpenseDate] = useState(todayIsoDate());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setAmount('');
    setCategory('Miscellaneous');
    setExpenseDate(todayIsoDate());
    setDescription('');
    setError(null);
    setBusy(false);
  }

  function close(): void {
    reset();
    onClose();
  }

  async function onSubmit(): Promise<void> {
    setError(null);
    const parsed = parseForm({ amount, category, expenseDate, description });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const expense = await createExpense(parsed.input);
      reset();
      onCreated(expense);
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
              <Text style={[styles.title, { color: tokens.text }]}>Add expense</Text>
              <Text style={[styles.hint, { color: tokens.textMuted }]}>
                Amount, category, and date (YYYY-MM-DD) are required.
              </Text>

              <Text style={[styles.label, { color: tokens.textMuted }]}>Amount</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
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

              <Text style={[styles.label, { color: tokens.textMuted }]}>Category</Text>
              <View style={styles.chips}>
                {EXPENSE_CATEGORIES.map((item) => {
                  const selected = category === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
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

              <Text style={[styles.label, { color: tokens.textMuted }]}>
                Expense date (YYYY-MM-DD)
              </Text>
              <TextInput
                value={expenseDate}
                onChangeText={setExpenseDate}
                autoCapitalize="none"
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

              <Text style={[styles.label, { color: tokens.textMuted }]}>
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
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

              {error ? (
                <View style={styles.errorWrap}>
                  <ErrorBanner message={error} />
                </View>
              ) : null}

              <GoldButton
                label={busy ? 'Saving…' : 'Create expense'}
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

function parseForm(fields: {
  amount: string;
  category: ExpenseCategory;
  expenseDate: string;
  description: string;
}): { ok: true; input: CreateExpenseInput } | { ok: false; error: string } {
  const amount = Number(fields.amount.trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be greater than 0' };
  }
  const expense_date = fields.expenseDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
    return { ok: false, error: 'Expense date is required (YYYY-MM-DD)' };
  }
  const description = fields.description.trim();
  return {
    ok: true,
    input: {
      amount,
      category: fields.category,
      expense_date,
      ...(description.length > 0 ? { description } : {}),
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
    fontSize: 13,
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
