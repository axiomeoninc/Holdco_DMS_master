import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { errorMessage, isForbidden } from '@/lib/errors';
import { listServiceRecords, serviceRecordTitle } from '@/lib/service';
import type { ServiceRecord } from '@/lib/types';

export default function ServiceScreen() {
  const { tokens, palette } = useTheme();

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [endpointMissing, setEndpointMissing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listServiceRecords(50);
      setRecords(result.records);
      setCount(result.count);
      setForbidden(false);
      setEndpointMissing(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setRecords([]);
        setCount(0);
        setError(null);
      } else if (err instanceof ApiError && err.status === 404) {
        setEndpointMissing(true);
        setRecords([]);
        setCount(0);
        setError(null);
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
          title: 'Service',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Service</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && records.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            records.length === 0 ? styles.emptyList : styles.list
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
                title={
                  forbidden
                    ? 'No access'
                    : endpointMissing
                      ? 'Service unavailable'
                      : 'No service records'
                }
                body={
                  forbidden
                    ? 'You do not have permission to view service records.'
                    : endpointMissing
                      ? 'Service records are unavailable right now.'
                      : 'No service records right now.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                },
              ]}
            >
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                {serviceRecordTitle(item)}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {item.status ?? 'No status'}
                {item.service_date ? ` · ${item.service_date}` : ''}
                {item.customer?.name ? ` · ${item.customer.name}` : ''}
              </Text>
            </View>
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
