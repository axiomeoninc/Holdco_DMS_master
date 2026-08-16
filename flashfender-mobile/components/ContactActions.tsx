import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/components/ui';
import { openMail, openMaps, openSms, openTel } from '@/lib/links';
import { toastError } from '@/lib/toast';

type ContactActionsProps = {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Could not open that link.');
  }
}

export function ContactActions({ phone, email, address }: ContactActionsProps) {
  const { tokens, palette } = useTheme();
  const hasAny = Boolean(phone || email || address);
  if (!hasAny) return null;

  return (
    <View style={styles.row}>
      {phone ? (
        <Pressable
          onPress={() => {
            void run(() => openTel(phone));
          }}
          style={({ pressed }) => [
            styles.btn,
            {
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.label, { color: palette.primary }]}>Call</Text>
        </Pressable>
      ) : null}
      {phone ? (
        <Pressable
          onPress={() => {
            void run(() => openSms(phone));
          }}
          style={({ pressed }) => [
            styles.btn,
            {
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.label, { color: palette.primary }]}>Text</Text>
        </Pressable>
      ) : null}
      {email ? (
        <Pressable
          onPress={() => {
            void run(() => openMail(email));
          }}
          style={({ pressed }) => [
            styles.btn,
            {
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.label, { color: palette.primary }]}>Email</Text>
        </Pressable>
      ) : null}
      {address ? (
        <Pressable
          onPress={() => {
            void run(() => openMaps(address));
          }}
          style={({ pressed }) => [
            styles.btn,
            {
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.label, { color: palette.primary }]}>Map</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
