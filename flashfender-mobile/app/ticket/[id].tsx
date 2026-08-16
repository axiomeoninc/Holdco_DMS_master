import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import type { ThemeTokens } from '@/constants/tokens';
import { errorMessage, isForbidden } from '@/lib/errors';
import { toastError, toastSuccess } from '@/lib/toast';
import { getTicket, patchTicketStatus, TICKET_STATUSES, ticketTitle } from '@/lib/tickets';
import type { Ticket } from '@/lib/types';

export default function TicketDetailScreen() {
  const { tokens, palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Missing ticket id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getTicket(id);
      setTicket(next);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setTicket(null);
        setError(null);
      } else {
        setError(errorMessage(err));
        setTicket(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStatus(status: (typeof TICKET_STATUSES)[number]): Promise<void> {
    if (!ticket || busy) return;
    setBusy(true);
    try {
      const next = await patchTicketStatus(ticket.id, status);
      setTicket(next);
      toastSuccess(`Status set to ${status}`);
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ticket ? ticketTitle(ticket) : 'Ticket',
          headerBackTitle: 'Back',
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : forbidden ? (
        <EmptyState
          title="No access"
          body="You do not have permission to view this ticket."
        />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !ticket ? (
        <EmptyState title="Ticket not found" body="This ticket could not be loaded." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: tokens.text }]}>
            {ticketTitle(ticket)}
          </Text>
          <Row label="Status" value={ticket.status ?? '—'} tokens={tokens} />
          <View style={styles.statusRow}>
            {TICKET_STATUSES.map((status) => {
              const selected = ticket.status === status;
              return (
                <Pressable
                  key={status}
                  disabled={busy || selected}
                  onPress={() => {
                    void onStatus(status);
                  }}
                  style={[
                    styles.statusChip,
                    {
                      borderColor: selected ? palette.primary : tokens.border,
                      backgroundColor: selected ? palette.primarySoft : tokens.surface,
                      opacity: busy ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: selected ? palette.primary : tokens.text },
                    ]}
                  >
                    {status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Row label="Priority" value={ticket.priority ?? '—'} tokens={tokens} />
          <Row
            label="Assigned"
            value={ticket.assigned_user?.full_name ?? 'Unassigned'}
            tokens={tokens}
          />
          <Row label="Created" value={ticket.created_at ?? '—'} tokens={tokens} />
          {ticket.description ? (
            <Row label="Description" value={ticket.description} tokens={tokens} />
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
  value: string;
  tokens: ThemeTokens;
}) {
  return (
    <View style={[styles.row, { borderColor: tokens.border }]}>
      <Text style={[styles.label, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: tokens.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
  },
});
