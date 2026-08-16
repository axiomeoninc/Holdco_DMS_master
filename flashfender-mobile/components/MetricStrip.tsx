import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HairlineCard, useTheme } from '@/components/ui';

export type MetricStripItem = {
  key: string;
  label: string;
  value: number | null;
};

type MetricStripProps = {
  metrics: MetricStripItem[];
  onPressMetric?: (key: string) => void;
};

export function MetricStrip({ metrics, onPressMetric }: MetricStripProps) {
  const { tokens } = useTheme();

  return (
    <HairlineCard style={styles.card}>
      <View style={styles.row}>
        {metrics.map((metric, index) => {
          const display =
            metric.value === null ? '—' : String(metric.value);
          const cell = (
            <View
              style={[
                styles.cell,
                index < metrics.length - 1
                  ? {
                      borderRightWidth: StyleSheet.hairlineWidth,
                      borderRightColor: tokens.border,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.value,
                  {
                    color:
                      metric.value === null ? tokens.textMuted : tokens.text,
                  },
                ]}
              >
                {display}
              </Text>
              <Text style={[styles.label, { color: tokens.textMuted }]}>
                {metric.label}
              </Text>
            </View>
          );

          if (!onPressMetric) {
            return (
              <View key={metric.key} style={styles.pressable}>
                {cell}
              </View>
            );
          }

          return (
            <Pressable
              key={metric.key}
              style={styles.pressable}
              onPress={() => onPressMetric(metric.key)}
              accessibilityRole="button"
              accessibilityLabel={`${metric.label}: ${display}`}
            >
              {cell}
            </Pressable>
          );
        })}
      </View>
    </HairlineCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
  },
  pressable: {
    flex: 1,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
