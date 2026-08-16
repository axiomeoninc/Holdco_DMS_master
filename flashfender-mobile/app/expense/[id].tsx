import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { errorMessage, isForbidden } from '@/lib/errors';
import { expenseTitle, getExpense } from '@/lib/expenses';
import { formatPriceCad } from '@/lib/money';
import type { Expense } from '@/lib/types';

export default function ExpenseDetailScreen() {
  const { tokens, palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Missing expense id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getExpense(id);
      setExpense(next);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setExpense(null);
        setError(null);
      } else {
        setError(errorMessage(err));
        setExpense(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: expense ? expenseTitle(expense) : 'Expense',
          headerBackTitle: 'Back',
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : forbidden ? (
        <EmptyState
          title="No access"
          body="You do not have permission to view this expense."
        />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !expense ? (
        <EmptyState title="Expense not found" body="This expense could not be loaded." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: tokens.text }]}>
            {expenseTitle(expense)}
          </Text>
          <Row label="Status" value={expense.status ?? '—'} tokens={tokens} />
          <Row label="Category" value={expense.category ?? '—'} tokens={tokens} />
          <Row label="Amount" value={formatPriceCad(expense.amount)} tokens={tokens} />
          <Row label="Tax" value={formatPriceCad(expense.tax_amount)} tokens={tokens} />
          <Row label="Date" value={expense.expense_date ?? '—'} tokens={tokens} />
          <Row label="Due date" value={expense.due_date ?? '—'} tokens={tokens} />
          <Row
            label="Vendor"
            value={expense.vendor?.vendor_name ?? '—'}
            tokens={tokens}
          />
          {expense.description ? (
            <Row label="Description" value={expense.description} tokens={tokens} />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({
  label,
  value,
  tokens,
}: {
  label: string;
  value: string;
  tokens: { text: string; textMuted: string; border: string; surface: string };
}) {
  return (
    <View style={[styles.row, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
      <Text style={[styles.rowLabel, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: tokens.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 15,
  },
});
