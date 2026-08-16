import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AddVehicleSheet } from '@/components/AddVehicleSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, ListRow, OfflineBanner, Screen, Title, useTheme } from '@/components/ui';
import type { Vehicle } from '@/lib/types';
import { errorMessage, listVehicles, vehicleTitle } from '@/lib/vehicles';

const STATUS_FILTERS = ['Active', 'Pending', 'Sold', 'All'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function StockScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string | string[] }>();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Active');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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
        const result = await listVehicles({
          q: debouncedQuery,
          status,
          limit: 50,
        });
        setVehicles(result.vehicles);
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
    [debouncedQuery, status],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  useEffect(() => {
    if (firstParam(params.add) !== '1') return;
    if (canAdd) setSheetOpen(true);
    router.setParams({ add: undefined });
  }, [params.add, canAdd, router]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Title>Stock</Title>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>
            {count} {count === 1 ? 'vehicle' : 'vehicles'}
          </Text>
        ) : null}
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search VIN, stock, make, model"
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

      <View style={styles.chips}>
        {STATUS_FILTERS.map((item) => {
          const selected = status === item;
          return (
            <Pressable
              key={item}
              onPress={() => setStatus(item)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? palette.primary : tokens.border,
                  backgroundColor: selected ? palette.primarySoft : tokens.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? palette.primary : tokens.text },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {canAdd ? (
        <View style={styles.addWrap}>
          <GoldButton label="Add vehicle" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}

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

      {loading && vehicles.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlashList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            vehicles.length === 0 ? styles.emptyList : styles.list
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
                title="No vehicles"
                body={
                  debouncedQuery.length > 0 || status !== 'Active'
                    ? 'Nothing matched this search and status filter.'
                    : 'This dealership has no Active stock yet.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <ListRow
              title={vehicleTitle(item)}
              meta={
                item.stock_number
                  ? `Stock ${item.stock_number}`
                  : 'No stock number'
              }
              chip={item.status}
              onPress={() =>
                router.push({
                  pathname: '/vehicle/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
        />
      )}

      <AddVehicleSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(vehicle) => {
          setSheetOpen(false);
          void load('refresh');
          router.push({
            pathname: '/vehicle/[id]',
            params: { id: vehicle.id },
          });
        }}
        onForbidden={() => {
          setCanAdd(false);
          setSheetOpen(false);
          setError('Adding vehicles is not allowed for this account (403).');
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
  count: {
    fontSize: 13,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addWrap: {
    marginBottom: 12,
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
