import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { listTasks, patchTaskStatus, taskTitle } from '@/lib/tasks';
import { toastError, toastSuccess } from '@/lib/toast';
import type { Task } from '@/lib/types';

export default function TasksScreen() {
  const { tokens, palette } = useTheme();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listTasks({ limit: 50, myTasks: true });
      setTasks(result.tasks);
      setCount(result.count);
      setEndpointMissing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setEndpointMissing(true);
        setTasks([]);
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

  async function onToggleComplete(item: Task): Promise<void> {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    const nextStatus = item.status === 'Completed' ? 'Open' : 'Completed';
    try {
      await patchTaskStatus(item.id, nextStatus);
      toastSuccess(nextStatus === 'Completed' ? 'Task completed' : 'Task reopened');
      await load('refresh');
    } catch (err) {
      toastError(errorMessage(err));
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void load('initial');
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My tasks',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.text }]}>My tasks</Text>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>{count}</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && tasks.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlashList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            tasks.length === 0 ? styles.emptyList : styles.list
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
                title={endpointMissing ? 'Tasks unavailable' : 'No tasks'}
                body={
                  endpointMissing
                    ? 'Could not load tasks right now.'
                    : 'No tasks assigned to you right now.'
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
                {taskTitle(item)}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textMuted }]}>
                {item.status ?? 'No status'}
                {item.priority ? ` · ${item.priority}` : ''}
                {item.due_date ? ` · ${item.due_date}` : ''}
              </Text>
              <Pressable
                disabled={busyId === item.id}
                onPress={() => {
                  void onToggleComplete(item);
                }}
                style={({ pressed }) => [
                  styles.action,
                  {
                    borderColor: palette.primaryHairline,
                    opacity: pressed || busyId === item.id ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.actionLabel, { color: palette.primary }]}>
                  {item.status === 'Completed' ? 'Reopen' : 'Complete'}
                </Text>
              </Pressable>
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
  action: {
    alignSelf: 'flex-start',
    marginTop: 10,
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
