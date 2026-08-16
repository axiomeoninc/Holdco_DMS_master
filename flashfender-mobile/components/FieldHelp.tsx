import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/components/ui';

export function FieldHelp({ children }: { children: string }) {
  const { tokens, palette } = useTheme();

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: palette.primarySoft,
          borderColor: palette.primaryHairline,
        },
      ]}
    >
      <Text style={[styles.text, { color: tokens.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
});
