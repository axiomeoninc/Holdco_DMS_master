import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ContactActions } from '@/components/ContactActions';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import { customerTitle, getCustomer } from '@/lib/customers';
import { errorMessage } from '@/lib/errors';
import type { Customer } from '@/lib/types';

export default function CustomerDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { tokens, palette } = useTheme();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!id) {
        setError('Missing customer id.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setCustomer(await getCustomer(id));
      } catch (err) {
        setCustomer(null);
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

  const title = customer ? customerTitle(customer) : 'Customer';

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackTitle: 'People',
        }}
      />

      {loading && !customer ? (
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

          {!customer && !loading ? (
            <EmptyState
              title="Customer not found"
              body="This customer could not be loaded."
            />
          ) : null}

          {customer ? (
            <>
              <Text style={[styles.heading, { color: tokens.text }]}>{title}</Text>
              <ContactActions phone={customer.phone} email={customer.email} />
              <Row label="Email" value={customer.email} tokens={tokens} />
              <Row label="Phone" value={customer.phone} tokens={tokens} />
              <Row label="Status" value={customer.status} tokens={tokens} />
              <Row label="Source" value={customer.source} tokens={tokens} />
              <Row
                label="Marketing consent"
                value={customer.marketing_consent ? 'On' : 'Off'}
                tokens={tokens}
              />
              <Row
                label="SMS consent"
                value={customer.sms_consent ? 'On' : 'Off'}
                tokens={tokens}
              />
              <Text style={[styles.note, { color: tokens.textMuted }]}>
                CASL: consent is off unless explicitly recorded as true. Do not
                message until consent is on.
              </Text>
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
  note: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
});
