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
import { errorMessage, isForbidden } from '@/lib/errors';
import type { Vendor } from '@/lib/types';
import { getVendor, vendorTitle } from '@/lib/vendors';

export default function VendorDetailScreen() {
  const { tokens, palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Missing vendor id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getVendor(id);
      setVendor(next);
      setForbidden(false);
    } catch (err) {
      if (isForbidden(err)) {
        setForbidden(true);
        setVendor(null);
        setError(null);
      } else {
        setError(errorMessage(err));
        setVendor(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: vendor ? vendorTitle(vendor) : 'Vendor',
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
          body="You do not have permission to view this vendor."
        />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !vendor ? (
        <EmptyState title="Vendor not found" body="This vendor could not be loaded." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: tokens.text }]}>
            {vendorTitle(vendor)}
          </Text>
          <Row label="Type" value={vendor.vendor_type ?? '—'} tokens={tokens} />
          <Row label="Contact" value={vendor.contact_name ?? '—'} tokens={tokens} />
          <Row label="Phone" value={vendor.phone ?? '—'} tokens={tokens} />
          <Row label="Email" value={vendor.email ?? '—'} tokens={tokens} />
          <Row label="Address" value={vendor.address ?? '—'} tokens={tokens} />
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
});
