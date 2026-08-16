import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Screen, useTheme } from '@/components/ui';

export default function NotFoundScreen() {
  const { tokens, palette } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen style={styles.container}>
        <Text style={[styles.title, { color: tokens.text }]}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: palette.primary }]}>Go home</Text>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
