import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { AddDealSheet } from '@/components/AddDealSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, Screen, useTheme } from '@/components/ui';
import { dealTitle, formatPriceCad, listDeals } from '@/lib/deals';
import { errorMessage } from '@/lib/errors';
import type { Deal } from '@/lib/types';

export default function DealsScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const result = await listDeals({ q: debouncedQuery, limit: 50 });
        setDeals(result.deals);
        setCount(result.count);
      } catch (err) {
        setError(errorMessage(err));
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
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Deals',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Deals</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>
            {count} {count === 1 ? 'deal' : 'deals'}
          </Text>
        ) : null}
      </View>

      {canAdd ? (
        <View style={styles.addWrap}>
          <GoldButton label="Add deal" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search deals"
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

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && deals.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={deals.length === 0 ? styles.emptyList : styles.list}
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
                title="No deals"
                body={
                  debouncedQuery.length > 0
                    ? 'Nothing matched this search.'
                    : 'This dealership has no deals yet.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/deal/[id]',
                  params: { id: item.id },
                })
              }
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
                {dealTitle(item)}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {item.deal_status ?? 'No status'}
                {' · '}
                {formatPriceCad(item.sale_price)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <AddDealSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(deal) => {
          setSheetOpen(false);
          void load('refresh');
          router.push({
            pathname: '/deal/[id]',
            params: { id: deal.id },
          });
        }}
        onForbidden={() => {
          setCanAdd(false);
          setSheetOpen(false);
          setError('Adding deals is not allowed for this account (403).');
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
    fontSize: 28,
    fontWeight: '700',
  },
  count: {
    fontSize: 13,
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
