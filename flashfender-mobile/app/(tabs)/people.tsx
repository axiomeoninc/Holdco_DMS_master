import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { AddCustomerSheet } from '@/components/AddCustomerSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, ListRow, OfflineBanner, Screen, Title, useTheme } from '@/components/ui';
import { customerTitle, listCustomers } from '@/lib/customers';
import { errorMessage } from '@/lib/errors';
import type { Customer } from '@/lib/types';

export default function PeopleScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [canAdd, setCanAdd] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await listCustomers({ q: debouncedQuery, limit: 50 });
        setCustomers(result.customers);
        setCount(result.count);
        setFromCache(result.fromCache === true);
      } catch (err) {
        setError(errorMessage(err));
        setFromCache(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Title>People</Title>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>
            {count} {count === 1 ? 'customer' : 'customers'}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.casl, { color: tokens.textMuted }]}>
        CASL: marketing and SMS consent are off unless recorded as true.
      </Text>

      {canAdd ? (
        <View style={styles.addWrap}>
          <GoldButton label="Add customer" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, email, phone"
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.search,
          {
            color: tokens.text,
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
          },
        ]}
      />

      {fromCache ? (
        <View style={styles.errorWrap}>
          <OfflineBanner />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && customers.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlashList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            customers.length === 0 ? styles.emptyList : styles.list
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
                title="No customers"
                body={
                  debouncedQuery.length > 0
                    ? 'Nothing matched this search.'
                    : 'This dealership has no customers yet.'
                }
                note="CASL: do not message until consent is recorded."
              />
            )
          }
          renderItem={({ item }) => (
            <ListRow
              title={customerTitle(item)}
              meta={item.email ?? item.phone ?? 'No contact'}
              chip={item.sms_consent ? 'SMS on' : 'SMS off'}
              onPress={() =>
                router.push({
                  pathname: '/customer/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
        />
      )}

      <AddCustomerSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(customer) => {
          setSheetOpen(false);
          void load('refresh');
          router.push({
            pathname: '/customer/[id]',
            params: { id: customer.id },
          });
        }}
        onForbidden={() => {
          setCanAdd(false);
          setSheetOpen(false);
          setError('Adding customers is not allowed for this account (403).');
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
    marginBottom: 8,
  },
  count: {
    fontSize: 13,
  },
  casl: {
    fontSize: 12,
    marginBottom: 10,
  },
  addWrap: {
    marginBottom: 10,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
  },
});
