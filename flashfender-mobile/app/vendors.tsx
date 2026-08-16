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
import type { Vendor } from '@/lib/types';
import { listVendors, vendorTitle } from '@/lib/vendors';

export default function VendorsScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>([]);
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
      const result = await listVendors(100);
      setVendors(result.vendors);
      setCount(result.count);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setVendors([]);
        setCount(0);
        setError(null);
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Vendors API not found.');
        setVendors([]);
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
          title: 'Vendors',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Vendors</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && vendors.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            vendors.length === 0 ? styles.emptyList : styles.list
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
                title={forbidden ? 'No access' : 'No vendors'}
                body={
                  forbidden
                    ? 'You do not have permission to view vendors.'
                    : 'No vendors returned from the API.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/vendor/${item.id}`)}
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
                {vendorTitle(item)}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {item.vendor_type ?? 'Vendor'}
                {item.phone ? ` · ${item.phone}` : ''}
              </Text>
            </Pressable>
          )}
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
