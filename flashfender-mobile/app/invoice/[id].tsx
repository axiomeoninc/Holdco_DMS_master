import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, Screen, useTheme } from '@/components/ui';
import { errorMessage, isForbidden } from '@/lib/errors';
import {
  getInvoice,
  invoiceTitle,
  startInvoiceCheckout,
} from '@/lib/invoices';
import { balanceDue, formatPriceCad } from '@/lib/money';
import type { Invoice } from '@/lib/types';

export default function InvoiceDetailScreen() {
  const { tokens, palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [hidePay, setHidePay] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Missing invoice id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getInvoice(id);
      setInvoice(next);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setInvoice(null);
        setError(null);
      } else {
        setError(errorMessage(err));
        setInvoice(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const due = invoice ? balanceDue(invoice.total, invoice.amount_paid) : null;
  const canOfferPay =
    !hidePay &&
    !forbidden &&
    invoice !== null &&
    invoice.status !== 'Paid' &&
    invoice.status !== 'Cancelled' &&
    due !== null &&
    due > 0;

  const onPayOnline = async () => {
    if (!invoice) return;
    setPayBusy(true);
    setPayMessage(null);
    const result = await startInvoiceCheckout(invoice.id);
    setPayBusy(false);
    if (result.ok) {
      await Linking.openURL(result.url);
      return;
    }
    if (result.forbidden) {
      setHidePay(true);
      setPayMessage('You do not have permission to start checkout.');
      return;
    }
    if (result.code === 'PAYMENTS_NOT_CONFIGURED') {
      setPayMessage(
        'Payments are not configured — online checkout is not live yet. No charge was made.',
      );
      return;
    }
    setPayMessage(result.message);
  };

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: invoice ? invoiceTitle(invoice) : 'Invoice',
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
          body="You do not have permission to view this invoice."
        />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !invoice ? (
        <EmptyState title="Invoice not found" body="This invoice could not be loaded." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: tokens.text }]}>
            {invoiceTitle(invoice)}
          </Text>
          <Row label="Payment status" value={invoice.status ?? '—'} tokens={tokens} />
          <Row
            label="Customer"
            value={invoice.customer?.name ?? invoice.customer?.email ?? '—'}
            tokens={tokens}
          />
          <Row label="Invoice date" value={invoice.invoice_date ?? '—'} tokens={tokens} />
          <Row label="Due date" value={invoice.due_date ?? '—'} tokens={tokens} />
          <Row label="Subtotal" value={formatPriceCad(invoice.payment_amount)} tokens={tokens} />
          <Row label="Tax" value={formatPriceCad(invoice.tax_amount)} tokens={tokens} />
          <Row label="Total" value={formatPriceCad(invoice.total)} tokens={tokens} />
          <Row label="Amount paid" value={formatPriceCad(invoice.amount_paid)} tokens={tokens} />
          <Row label="Balance due" value={formatPriceCad(due)} tokens={tokens} />
          {invoice.notes ? (
            <Row label="Notes" value={invoice.notes} tokens={tokens} />
          ) : null}

          {payMessage ? (
            <View style={styles.payMsg}>
              <ErrorBanner message={payMessage} />
            </View>
          ) : null}

          {canOfferPay ? (
            <View style={styles.payWrap}>
              {payBusy ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <GoldButton label="Pay online" onPress={() => void onPayOnline()} />
              )}
              <Text style={[styles.payHint, { color: tokens.textMuted }]}>
                Opens Stripe Checkout when payments are configured. Never fakes success.
              </Text>
            </View>
          ) : null}

          <Pressable onPress={() => void load()} style={styles.refresh}>
            <Text style={{ color: palette.primary, fontWeight: '600' }}>Refresh</Text>
          </Pressable>
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
    marginBottom: 12,
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
  payWrap: {
    marginTop: 16,
  },
  payHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  payMsg: {
    marginTop: 12,
  },
  refresh: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
