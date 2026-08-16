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

import { EmptyState } from '@/components/EmptyState';
import { FieldHelp } from '@/components/FieldHelp';
import { ErrorBanner, Screen, useTheme } from '@/components/ui';
import {
  dealTitle,
  estimateMonthlyPayment,
  formatPriceCad,
  getDeal,
} from '@/lib/deals';
import { errorMessage } from '@/lib/errors';
import type { Deal } from '@/lib/types';

export default function DealDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { tokens, palette } = useTheme();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!id) {
        setError('Missing deal id.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setDeal(await getDeal(id));
      } catch (err) {
        setDeal(null);
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

  const title = deal ? dealTitle(deal) : 'Deal';
  const monthly = deal ? estimateMonthlyPayment(deal) : null;

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackTitle: 'Deals',
        }}
      />

      {loading && !deal ? (
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

          {!deal && !loading ? (
            <EmptyState title="Deal not found" body="This deal could not be loaded." />
          ) : null}

          {deal ? (
            <>
              <Text style={[styles.heading, { color: tokens.text }]}>{title}</Text>
              <Row label="Status" value={deal.deal_status} tokens={tokens} />
              <Row
                label="Customer"
                value={deal.customer?.name ?? deal.customer?.email ?? null}
                tokens={tokens}
              />
              <Row label="Sale price" value={formatPriceCad(deal.sale_price)} tokens={tokens} />
              <Row
                label="Down payment"
                value={formatPriceCad(deal.down_payment)}
                tokens={tokens}
              />
              <Row
                label="Trade-in"
                value={formatPriceCad(deal.trade_in_value)}
                tokens={tokens}
              />
              <Row
                label="Finance term"
                value={
                  deal.finance_term !== null ? `${deal.finance_term} months` : null
                }
                tokens={tokens}
              />
              <Row
                label="Interest rate"
                value={
                  deal.interest_rate !== null ? `${deal.interest_rate}%` : null
                }
                tokens={tokens}
              />

              <View
                style={[
                  styles.estimate,
                  { borderColor: tokens.border, backgroundColor: tokens.surface },
                ]}
              >
                <Text style={[styles.estimateLabel, { color: tokens.textMuted }]}>
                  Monthly estimate
                </Text>
                <Text style={[styles.estimateValue, { color: tokens.text }]}>
                  {monthly === null ? '—' : formatPriceCad(monthly)}
                </Text>
                <FieldHelp>
                  Estimate only — principal = sale − down − trade. Not a lender
                  commitment.
                </FieldHelp>
              </View>
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
  estimate: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
  },
  estimateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
});
