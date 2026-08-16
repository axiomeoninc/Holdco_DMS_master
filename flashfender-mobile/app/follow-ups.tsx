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
import { Stack } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import {
  followUpTitle,
  listFollowUps,
  patchFollowUp,
  tomorrowIsoDate,
} from '@/lib/followUps';
import type { FollowUp } from '@/lib/types';

export default function FollowUpsScreen() {
  const { tokens, palette } = useTheme();

  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [canPatch, setCanPatch] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listFollowUps({ limit: 20, todayOnly: true });
      setFollowUps(result.followUps);
      setCount(result.count);
      setEndpointMissing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setEndpointMissing(true);
        setFollowUps([]);
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

  async function onComplete(item: FollowUp): Promise<void> {
    if (!canPatch || busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await patchFollowUp(item.id, { status: 'Completed' });
      await load('refresh');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setCanPatch(false);
        setError('Updating follow-ups is not allowed for this account (403).');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onSnooze(item: FollowUp): Promise<void> {
    if (!canPatch || busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      // PATCH /api/follow-ups/:id accepts follow_up_date — move to tomorrow.
      await patchFollowUp(item.id, {
        status: 'Pending',
        follow_up_date: tomorrowIsoDate(),
      });
      await load('refresh');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setCanPatch(false);
        setError('Updating follow-ups is not allowed for this account (403).');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Today's follow-ups",
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>{"Today's follow-ups"}</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>
            {count}
          </Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && followUps.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={followUps}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            followUps.length === 0 ? styles.emptyList : styles.list
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
                title={endpointMissing ? 'Follow-ups unavailable' : 'No follow-ups today'}
                body={
                  endpointMissing
                    ? 'The follow-ups API did not respond. Nothing is fabricated here.'
                    : 'Nothing is scheduled for today.'
                }
              />
            )
          }
          renderItem={({ item }) => {
            const actionable =
              canPatch &&
              item.status !== 'Completed' &&
              item.status !== 'Cancelled';
            const busy = busyId === item.id;
            return (
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
                  {followUpTitle(item)}
                </Text>
                <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                  {item.status ?? 'No status'}
                  {item.priority ? ` · ${item.priority}` : ''}
                  {item.follow_up_date ? ` · ${item.follow_up_date}` : ''}
                </Text>
                {item.customer?.name || item.customer?.phone ? (
                  <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                    {item.customer.name ?? item.customer.phone}
                  </Text>
                ) : null}
                {actionable ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => {
                        void onComplete(item);
                      }}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        {
                          borderColor: tokens.border,
                          opacity: busy || pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.actionLabel, { color: palette.primary }]}>
                        {busy ? '…' : 'Complete'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        void onSnooze(item);
                      }}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        {
                          borderColor: tokens.border,
                          opacity: busy || pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.actionLabel, { color: tokens.text }]}>
                        Snooze +1d
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
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
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
