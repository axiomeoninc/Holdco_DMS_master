import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { errorMessage, isForbidden } from '@/lib/errors';
import { getLead, leadTitle, patchLeadStatus } from '@/lib/leads';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '@/lib/types';

export default function LeadDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { tokens, palette } = useTheme();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEditStatus, setCanEditStatus] = useState(true);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!id) {
        setError('Missing lead id.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setLead(await getLead(id));
      } catch (err) {
        setLead(null);
        setError(errorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const onStatusPress = async (status: LeadStatus) => {
    if (!id || !canEditStatus || saving) return;
    if (lead?.status === status) return;
    setSaving(true);
    setError(null);
    try {
      setLead(await patchLeadStatus(id, status));
    } catch (err) {
      if (isForbidden(err)) {
        setCanEditStatus(false);
        setError('Updating lead status is not allowed for this account (403).');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const title = lead ? leadTitle(lead) : 'Lead';

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackTitle: 'Pipeline',
        }}
      />

      {loading && !lead ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void load('refresh');
              }}
              tintColor={palette.primary}
            />
          }
        >
          {error ? (
            <View style={styles.errorWrap}>
              <ErrorBanner message={error} />
            </View>
          ) : null}

          {!lead && !loading ? (
            <EmptyState title="Lead not found" body="This lead could not be loaded." />
          ) : null}

          {lead ? (
            <>
              <Text style={[styles.heading, { color: tokens.text }]}>{title}</Text>
              <Row label="Status" value={lead.status} tokens={tokens} />
              <Row label="Source" value={lead.source} tokens={tokens} />
              <Row label="Temperature" value={lead.temperature} tokens={tokens} />
              <Row label="Email" value={lead.customer?.email ?? null} tokens={tokens} />
              <Row label="Phone" value={lead.customer?.phone ?? null} tokens={tokens} />
              <Row label="Notes" value={lead.notes} tokens={tokens} />

              {canEditStatus ? (
                <View style={styles.statusBlock}>
                  <Text style={[styles.statusLabel, { color: tokens.textMuted }]}>
                    Change status
                  </Text>
                  <View style={styles.chips}>
                    {LEAD_STATUSES.map((status) => {
                      const selected = lead.status === status;
                      return (
                        <Pressable
                          key={status}
                          disabled={saving}
                          onPress={() => {
                            void onStatusPress(status);
                          }}
                          style={[
                            styles.chip,
                            {
                              borderColor: selected ? palette.primary : tokens.border,
                              backgroundColor: selected
                                ? palette.primarySoft
                                : tokens.surface,
                              opacity: saving ? 0.6 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipLabel,
                              { color: selected ? palette.primary : tokens.text },
                            ]}
                          >
                            {status}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({
  label,
  value,
  tokens,
}: {
  label: string;
  value: string | null;
  tokens: { text: string; textMuted: string; border: string; surface: string };
}) {
  return (
    <View style={[styles.row, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
      <Text style={[styles.rowLabel, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: tokens.text }]}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 15,
  },
  statusBlock: {
    marginTop: 12,
  },
  statusLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});
