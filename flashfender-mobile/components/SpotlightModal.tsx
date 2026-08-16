import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { useTheme } from '@/components/ui';

const ACTIONS = ['New vehicle', "Today's follow-ups"] as const;

export function SpotlightButton() {
  const { tokens, palette } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        style={{ marginRight: 16 }}
        accessibilityRole="button"
        accessibilityLabel="Jump"
      >
        <Ionicons name="search-outline" size={22} color={tokens.text} />
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.panel, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: tokens.text }]}>Jump</Text>
            <Text style={[styles.hint, { color: tokens.textMuted }]}>
              {"Jump to stock or today's follow-ups."}
            </Text>
            {ACTIONS.map((label) => (
              <Pressable
                key={label}
                onPress={() => {
                  setOpen(false);
                  if (label === 'New vehicle') {
                    router.push({
                      pathname: '/(tabs)/stock',
                      params: { add: '1' },
                    });
                  } else if (label === "Today's follow-ups") {
                    router.push('/follow-ups');
                  }
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: tokens.border,
                    backgroundColor: pressed ? palette.primarySoft : tokens.surface,
                  },
                ]}
              >
                <Text style={[styles.rowLabel, { color: tokens.text }]}>{label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 88,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
