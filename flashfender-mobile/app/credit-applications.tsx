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
import {
  creditApplicationTitle,
  listCreditApplications,
} from '@/lib/creditApplications';
import { errorMessage, isForbidden } from '@/lib/errors';
import type { CreditApplication } from '@/lib/types';

export default function CreditApplicationsScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [applications, setApplications] = useState<CreditApplication[]>([]);
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
      const result = await listCreditApplications(50);
      setApplications(result.applications);
      setCount(result.count);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setApplications([]);
        setCount(0);
        setError(null);
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Credit applications API not found.');
        setApplications([]);
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
          title: 'Credit applications',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Credit applications</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && applications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            applications.length === 0 ? styles.emptyList : styles.list
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
                title={forbidden ? 'No access' : 'No applications'}
                body={
                  forbidden
                    ? 'You do not have permission to view credit applications.'
                    : 'No credit applications returned. Read-only list — create stays on web.'
                }
                note="Write / submit is not available in mobile M3."
              />
            )
          }
          renderItem={({ item }) => {
            const vehicleParts: string[] = [];
            if (item.vehicle?.year !== null && item.vehicle?.year !== undefined) {
              vehicleParts.push(String(item.vehicle.year));
            }
            if (item.vehicle?.make) vehicleParts.push(item.vehicle.make);
            if (item.vehicle?.model) vehicleParts.push(item.vehicle.model);

            return (
              <Pressable
                onPress={() => router.push(`/credit/${item.id}`)}
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
                  {creditApplicationTitle(item)}
                </Text>
                <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                  {item.status ?? 'No status'}
                  {item.created_at ? ` · ${item.created_at}` : ''}
                </Text>
                {vehicleParts.length > 0 ? (
                  <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                    {vehicleParts.join(' ')}
                  </Text>
                ) : null}
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
