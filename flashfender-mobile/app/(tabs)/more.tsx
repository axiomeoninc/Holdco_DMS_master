import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, Title, useTheme } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/api';
import type { NotificationStatus } from '@/lib/storage';

type MoreLink = {
  href:
    | '/calendar'
    | '/test-drives'
    | '/tickets'
    | '/service'
    | '/deals'
    | '/follow-ups'
    | '/tasks'
    | '/invoices'
    | '/credit-applications'
    | '/expenses'
    | '/vendors';
  label: string;
  hint: string;
};

const LINKS: MoreLink[] = [
  {
    href: '/calendar',
    label: 'Calendar',
    hint: 'Appointments, deliveries, and due items',
  },
  {
    href: '/test-drives',
    label: 'Test drives',
    hint: 'Start and complete drives from the lot',
  },
  {
    href: '/tickets',
    label: 'Tickets',
    hint: 'Update ticket status',
  },
  {
    href: '/service',
    label: 'Service',
    hint: 'Service records',
  },
  {
    href: '/deals',
    label: 'Deals',
    hint: 'Sale price, finance, and estimates',
  },
  {
    href: '/follow-ups',
    label: "Today's follow-ups",
    hint: 'Complete or snooze due follow-ups',
  },
  {
    href: '/tasks',
    label: 'My tasks',
    hint: 'Complete assigned desk tasks',
  },
  {
    href: '/invoices',
    label: 'Invoices',
    hint: 'Payment status and checkout',
  },
  {
    href: '/credit-applications',
    label: 'Credit applications',
    hint: 'View credit apps',
  },
  {
    href: '/expenses',
    label: 'Expenses',
    hint: 'Log and review expenses',
  },
  {
    href: '/vendors',
    label: 'Vendors',
    hint: 'Vendor contacts',
  },
];

function notificationLabel(status: NotificationStatus): string {
  switch (status) {
    case 'enabled':
      return 'Notifications: enabled';
    case 'not_enabled':
      return 'Notifications: not enabled';
    case 'unsupported':
      return 'Notifications: not supported on this platform';
    case 'unknown':
      return 'Notifications: not registered yet';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export default function MoreScreen() {
  const { tokens, palette } = useTheme();
  const {
    user,
    signOut,
    biometricAvailable,
    biometricEnabled,
    setBiometricEnabled,
    notificationStatus,
    notificationReason,
  } = useAuth();
  const router = useRouter();
  const apiUrl = getApiBaseUrl();

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Title style={styles.title}>More</Title>

        {LINKS.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [
              styles.link,
              {
                borderColor: tokens.border,
                backgroundColor: tokens.surface,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.linkLabel, { color: tokens.text }]}>
              {link.label}
            </Text>
            <Text style={[styles.linkHint, { color: tokens.textMuted }]}>
              {link.hint}
            </Text>
          </Pressable>
        ))}

        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Settings</Text>

        <View
          style={[
            styles.session,
            { borderColor: tokens.border, backgroundColor: tokens.surface },
          ]}
        >
          <Text style={[styles.sessionLabel, { color: tokens.textMuted }]}>
            Signed in
          </Text>
          <Text style={[styles.sessionValue, { color: tokens.text }]}>
            {user?.email ?? 'Unknown'}
          </Text>

          <View style={[styles.divider, { backgroundColor: tokens.border }]} />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.sessionValue, { color: tokens.text }]}>
                Biometric unlock
              </Text>
              <Text style={[styles.linkHint, { color: tokens.textMuted }]}>
                {biometricAvailable
                  ? 'Require Face ID / biometrics on cold start'
                  : 'Unavailable on this device (web / simulator)'}
              </Text>
            </View>
            <Switch
              value={biometricEnabled && biometricAvailable}
              onValueChange={(value) => {
                void setBiometricEnabled(value);
              }}
              disabled={!biometricAvailable}
              trackColor={{ false: tokens.border, true: palette.primaryHairline }}
              thumbColor={
                biometricEnabled && biometricAvailable
                  ? palette.primary
                  : tokens.textMuted
              }
            />
          </View>

          <View style={[styles.divider, { backgroundColor: tokens.border }]} />

          <Text style={[styles.sessionLabel, { color: tokens.textMuted }]}>
            API URL
          </Text>
          <Text style={[styles.sessionValue, { color: tokens.text }]} selectable>
            {apiUrl}
          </Text>

          <View style={[styles.divider, { backgroundColor: tokens.border }]} />

          <Text style={[styles.sessionValue, { color: tokens.text }]}>
            {notificationLabel(notificationStatus)}
          </Text>
          {notificationStatus !== 'enabled' && notificationReason ? (
            <Text style={[styles.linkHint, { color: tokens.textMuted, marginTop: 4 }]}>
              {notificationReason}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            void signOut();
          }}
          style={({ pressed }) => [
            styles.signOut,
            {
              borderColor: tokens.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.signOutLabel, { color: palette.primary }]}>
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  title: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  session: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 16,
  },
  sessionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sessionValue: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  signOut: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
