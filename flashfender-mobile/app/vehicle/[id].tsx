import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import type { Vehicle } from '@/lib/types';
import {
  errorMessage,
  formatOdometerKm,
  formatPriceCad,
  getVehicle,
  resolveImageUrl,
  vehicleTitle,
} from '@/lib/vehicles';

export default function VehicleDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { tokens, palette } = useTheme();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!id) {
        setError('Missing vehicle id.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setVehicle(await getVehicle(id));
      } catch (err) {
        setVehicle(null);
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

  const title = vehicle ? vehicleTitle(vehicle) : 'Vehicle';

  return (
    <Screen style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackTitle: 'Stock',
        }}
      />

      {loading && !vehicle ? (
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

          {!vehicle && !loading ? (
            <EmptyState
              title="Vehicle not found"
              body="This id did not return a vehicle. Nothing is fabricated."
            />
          ) : null}

          {vehicle ? (
            <>
              <Text style={[styles.heading, { color: tokens.text }]}>{title}</Text>
              {vehicle.trim ? (
                <Text style={[styles.trim, { color: tokens.textMuted }]}>
                  {vehicle.trim}
                </Text>
              ) : (
                <View style={styles.spacer} />
              )}

              <FieldHelp>
                Known damage requires disclosure before a vehicle can be set Active
                (MVDA).
              </FieldHelp>

              {vehicle.image_gallery.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gallery}
                >
                  {vehicle.image_gallery.map((url) => (
                    <Image
                      key={url}
                      source={{ uri: resolveImageUrl(url) }}
                      style={[styles.photo, { backgroundColor: tokens.border }]}
                      accessibilityLabel="Vehicle photo"
                    />
                  ))}
                </ScrollView>
              ) : null}

              <Fact label="Status" value={vehicle.status} />
              <Fact label="Stock number" value={vehicle.stock_number} />
              <Fact label="VIN" value={vehicle.vin} />
              <Fact label="Odometer" value={formatOdometerKm(vehicle.odometer)} />
              <Fact label="Price" value={formatPriceCad(vehicle.retail_price)} />
              <Fact
                label="Known damage"
                value={
                  vehicle.known_damage === null
                    ? null
                    : vehicle.known_damage
                      ? 'Yes'
                      : 'No'
                }
              />
              {vehicle.disclosure ? (
                <Fact label="Disclosure" value={vehicle.disclosure} />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.fact, { borderColor: tokens.border }]}>
      <Text style={[styles.factLabel, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: tokens.text }]}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  trim: {
    fontSize: 15,
    marginBottom: 12,
  },
  spacer: {
    height: 12,
  },
  errorWrap: {
    marginBottom: 12,
  },
  gallery: {
    gap: 8,
    paddingVertical: 16,
  },
  photo: {
    width: 160,
    height: 100,
    borderRadius: 8,
  },
  fact: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  factLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  factValue: {
    fontSize: 16,
    fontWeight: '500',
  },
});
