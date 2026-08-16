import { StyleSheet, Text, View } from 'react-native';

import { HairlineCard, useTheme } from '@/components/ui';

type EmptyStateProps = {
  title: string;
  body: string;
  note?: string;
};

export function EmptyState({ title, body, note }: EmptyStateProps) {
  const { tokens, palette } = useTheme();

  return (
    <HairlineCard>
      <View
        style={[
          styles.well,
          { backgroundColor: palette.primarySoft, borderColor: palette.primaryHairline },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: palette.primary }]} />
      </View>
      <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
      <Text style={[styles.body, { color: tokens.textMuted }]}>{body}</Text>
      {note ? (
        <Text style={[styles.note, { color: tokens.textMuted, borderColor: tokens.border }]}>
          {note}
        </Text>
      ) : null}
    </HairlineCard>
  );
}

const styles = StyleSheet.create({
  well: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    lineHeight: 18,
  },
});
