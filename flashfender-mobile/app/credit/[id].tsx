import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import {
  creditApplicationTitle,
  getCreditApplication,
} from '@/lib/creditApplications';
import { errorMessage, isForbidden } from '@/lib/errors';
import type { CreditApplication } from '@/lib/types';

export default function CreditApplicationDetailScreen() {
  const { tokens, palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Missing application id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getCreditApplication(id);
      setApp(next);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setApp(null);
        setError(null);
      } else {
        setError(errorMessage(err));
        setApp(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const vehicleLabel = app?.vehicle
    ? [
        app.vehicle.year !== null ? String(app.vehicle.year) : null,
        app.vehicle.make,
        app.vehicle.model,
      ]
        .filter((part): part is string => part !== null && part.length > 0)
        .join(' ') || '—'
    : '—';

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: app ? creditApplicationTitle(app) : 'Credit application',
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
          body="You do not have permission to view this credit application."
        />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !app ? (
        <EmptyState
          title="Not found"
          body="This credit application could not be loaded."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: tokens.text }]}>
            {creditApplicationTitle(app)}
          </Text>
          <Text style={[styles.note, { color: tokens.textMuted }]}>
            Read-only. Submit and edits stay on the web for M3.
          </Text>
          <Row label="Status" value={app.status ?? '—'} tokens={tokens} />
          <Row
            label="Customer"
            value={app.customer?.name ?? app.customer?.email ?? '—'}
            tokens={tokens}
          />
          <Row label="Vehicle" value={vehicleLabel} tokens={tokens} />
          <Row label="Created" value={app.created_at ?? '—'} tokens={tokens} />
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
  tokens: { text: string; textMuted: string; border: string; surface: string };
}) {
  return (
    <View style={[styles.row, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
      <Text style={[styles.rowLabel, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: tokens.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
    marginBottom: 8,
  },
  note: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
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
});
