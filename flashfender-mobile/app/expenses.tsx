import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { AddExpenseSheet } from '@/components/AddExpenseSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, Screen, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { errorMessage, isForbidden } from '@/lib/errors';
import { expenseTitle, listExpenses } from '@/lib/expenses';
import { formatPriceCad } from '@/lib/money';
import type { Expense } from '@/lib/types';

export default function ExpensesScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [canAdd, setCanAdd] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listExpenses(50);
      setExpenses(result.expenses);
      setCount(result.count);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setExpenses([]);
        setCount(0);
        setError(null);
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Expenses API not found.');
        setExpenses([]);
        setCount(0);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Expenses',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Expenses</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {canAdd && !forbidden ? (
        <View style={styles.addWrap}>
          <GoldButton label="Add expense" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && expenses.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            expenses.length === 0 ? styles.emptyList : styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void load('refresh');
              }}
              tintColor={palette.primary}
            />
          }
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                title={forbidden ? 'No access' : 'No expenses'}
                body={
                  forbidden
                    ? 'You do not have permission to view expenses.'
                    : 'No expenses returned from the API.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/expense/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                {expenseTitle(item)}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {item.status ?? 'No status'}
                {item.category ? ` · ${item.category}` : ''}
                {item.expense_date ? ` · ${item.expense_date}` : ''}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {formatPriceCad(item.amount)}
                {item.vendor?.vendor_name ? ` · ${item.vendor.vendor_name}` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}

      <AddExpenseSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(expense) => {
          setSheetOpen(false);
          void load('refresh');
          router.push(`/expense/${expense.id}`);
        }}
        onForbidden={() => {
          setCanAdd(false);
          setSheetOpen(false);
          setError('Adding expenses is not allowed for this account (403).');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  count: {
    fontSize: 13,
  },
  addWrap: {
    marginBottom: 10,
  },
  errorWrap: {
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
