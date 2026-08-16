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
import { listTickets, ticketTitle } from '@/lib/tickets';
import type { Ticket } from '@/lib/types';

export default function TicketsScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
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
      const result = await listTickets(50);
      setTickets(result.tickets);
      setCount(result.count);
      setForbidden(false);
      setEndpointMissing(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setTickets([]);
        setCount(0);
        setError(null);
      } else if (err instanceof ApiError && err.status === 404) {
        setEndpointMissing(true);
        setTickets([]);
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
          title: 'Tickets',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>Tickets</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && tickets.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            tickets.length === 0 ? styles.emptyList : styles.list
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
                      ? 'Tickets unavailable'
                      : 'No tickets'
                }
                body={
                  forbidden
                    ? 'You do not have permission to view tickets.'
                    : endpointMissing
                      ? 'Tickets could not be loaded right now.'
                      : 'No tickets right now.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/ticket/${item.id}`)}
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
                {ticketTitle(item)}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {item.status ?? 'No status'}
                {item.priority ? ` · ${item.priority}` : ''}
                {item.assigned_user?.full_name
                  ? ` · ${item.assigned_user.full_name}`
                  : ''}
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
