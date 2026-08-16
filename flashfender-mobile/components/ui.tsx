import { useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { palette, tokensFor } from '@/constants/tokens';
import { useColorScheme } from '@/components/useColorScheme';

export function useTheme() {
  const scheme = useColorScheme();
  return useMemo(
    () => ({
      scheme,
      tokens: tokensFor(scheme),
      palette,
    }),
    [scheme],
  );
}

export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }, style]}>
      {children}
    </View>
  );
}

export function HairlineCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const { tokens } = useTheme();
  return (
    <Text style={[styles.title, { color: tokens.text }, style]}>{children}</Text>
  );
}

export function Body({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { tokens } = useTheme();
  return (
    <Text style={[styles.body, { color: tokens.textMuted }, style]}>{children}</Text>
  );
}

export function GoldButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette: colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.goldButton,
        {
          backgroundColor: pressed || disabled ? colors.primaryPressed : colors.primary,
          opacity: disabled ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.goldButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.errorBox,
        { backgroundColor: tokens.dangerSoft, borderColor: tokens.danger },
      ]}
    >
      <Text style={[styles.errorText, { color: tokens.danger }]}>{message}</Text>
    </View>
  );
}

/** Shown when a list falls back to the last successful sync. */
export function OfflineBanner() {
  const { tokens, palette } = useTheme();
  return (
    <View
      style={[
        styles.offlineBox,
        {
          backgroundColor: palette.primarySoft,
          borderColor: palette.primaryHairline,
        },
      ]}
    >
      <Text style={[styles.offlineText, { color: tokens.text }]}>
        Offline · showing last sync
      </Text>
    </View>
  );
}

export function StatusChip({ label }: { label: string }) {
  const { tokens, palette } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: palette.primaryHairline,
          backgroundColor: palette.primarySoft,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, { color: tokens.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ListRow({
  title,
  meta,
  onPress,
  chip,
}: {
  title: string;
  meta?: string | null;
  onPress?: () => void;
  chip?: string | null;
}) {
  const { tokens } = useTheme();
  const body = (
    <>
      <View style={styles.listRowTop}>
        <Text
          numberOfLines={1}
          style={[styles.listRowTitle, { color: tokens.text }]}
        >
          {title}
        </Text>
        {chip ? <StatusChip label={chip} /> : null}
      </View>
      {meta ? (
        <Text
          numberOfLines={1}
          style={[styles.listRowMeta, { color: tokens.textMuted }]}
        >
          {meta}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.listRow,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  goldButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  goldButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  offlineBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 120,
    marginLeft: 8,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  listRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  listRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listRowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  listRowMeta: {
    fontSize: 13,
    marginTop: 4,
  },
});
