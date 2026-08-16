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

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { errorMessage, isForbidden } from '@/lib/errors';
import { invoiceTitle, listInvoices } from '@/lib/invoices';
import { balanceDue, formatPriceCad } from '@/lib/money';
import type { Invoice } from '@/lib/types';

export default function InvoicesScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listInvoices(50);
      setInvoices(result.invoices);
      setCount(result.count);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setInvoices([]);
        setCount(0);
        setError(null);
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Invoices API not found.');
        setInvoices([]);
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
          title: 'Invoices',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Invoices</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && invoices.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            invoices.length === 0 ? styles.emptyList : styles.list
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
                title={forbidden ? 'No access' : 'No invoices'}
                body={
                  forbidden
                    ? 'You do not have permission to view invoices.'
                    : 'No invoices returned from the API.'
                }
              />
            )
          }
          renderItem={({ item }) => {
            const due = balanceDue(item.total, item.amount_paid);
            return (
              <Pressable
                onPress={() => router.push(`/invoice/${item.id}`)}
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
                  {invoiceTitle(item)}
                </Text>
                <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                  {item.status ?? 'No status'}
                  {item.customer?.name ? ` · ${item.customer.name}` : ''}
                </Text>
                <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                  Total {formatPriceCad(item.total)}
                  {due !== null && due > 0
                    ? ` · Due ${formatPriceCad(due)}`
                    : ''}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
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
