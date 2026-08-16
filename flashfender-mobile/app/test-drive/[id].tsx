import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ContactActions } from '@/components/ContactActions';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, Screen, useTheme } from '@/components/ui';
import { errorMessage, isForbidden } from '@/lib/errors';
import {
  completeTestDrive,
  getTestDrive,
  startTestDrive,
  testDriveTitle,
  testDriveWhen,
} from '@/lib/testDrives';
import { toastError, toastSuccess } from '@/lib/toast';
import type { TestDrive } from '@/lib/types';
import type { ThemeTokens } from '@/constants/tokens';

export default function TestDriveDetailScreen() {
  const { tokens, palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [drive, setDrive] = useState<TestDrive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Missing test drive id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getTestDrive(id);
      setDrive(next);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setDrive(null);
        setError(null);
      } else {
        setError(errorMessage(err));
        setDrive(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStart(): Promise<void> {
    if (!drive || busy) return;
    setBusy(true);
    try {
      const next = await startTestDrive(drive.id);
      setDrive(next);
      toastSuccess('Drive started');
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReturn(): Promise<void> {
    if (!drive || busy) return;
    setBusy(true);
    try {
      const next = await completeTestDrive(drive.id);
      setDrive(next);
      toastSuccess('Drive completed');
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const vehicleLabel = drive?.vehicle
    ? [
        drive.vehicle.year !== null ? String(drive.vehicle.year) : null,
        drive.vehicle.make,
        drive.vehicle.model,
      ]
        .filter((part): part is string => part !== null)
        .join(' ')
    : null;

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: drive ? testDriveTitle(drive) : 'Test drive',
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
          body="You do not have permission to view this test drive."
        />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !drive ? (
        <EmptyState
          title="Test drive not found"
          body="This test drive could not be loaded."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: tokens.text }]}>
            {testDriveTitle(drive)}
          </Text>
          <Row label="When" value={testDriveWhen(drive)} tokens={tokens} />
          <Row label="Status" value={drive.status ?? '—'} tokens={tokens} />
          <Row label="Outcome" value={drive.outcome ?? '—'} tokens={tokens} />
          <Row
            label="Customer"
            value={drive.customer?.name ?? '—'}
            tokens={tokens}
          />
          <Row label="Phone" value={drive.customer?.phone ?? '—'} tokens={tokens} />
          <ContactActions phone={drive.customer?.phone} />
          <View style={styles.actions}>
            <GoldButton
              label={busy ? 'Saving…' : 'Start drive'}
              disabled={busy || drive.status === 'In Progress' || drive.status === 'Completed'}
              onPress={() => {
                void onStart();
              }}
            />
            <View style={styles.actionGap} />
            <GoldButton
              label={busy ? 'Saving…' : 'Complete drive'}
              disabled={busy || drive.status === 'Completed'}
              onPress={() => {
                void onReturn();
              }}
            />
          </View>
          <Row label="Vehicle" value={vehicleLabel ?? '—'} tokens={tokens} />
          <Row
            label="Stock #"
            value={drive.vehicle?.stock_number ?? '—'}
            tokens={tokens}
          />
          {drive.notes ? (
            <Row label="Notes" value={drive.notes} tokens={tokens} />
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
  actions: {
    marginBottom: 16,
  },
  actionGap: {
    height: 8,
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
