import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { AskFlashButton } from '@/components/AskFlashSheet';
import { MetricStrip, type MetricStripItem } from '@/components/MetricStrip';
import { Body, ErrorBanner, ListRow, OfflineBanner, Screen, Title, useTheme } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { listCalendarEvents } from '@/lib/calendar';
import { isSameLocalDay } from '@/lib/dates';
import { followUpTitle, listFollowUps } from '@/lib/followUps';
import { fetchHomeKpis } from '@/lib/home';
import type { CalendarEvent, FollowUp, HomeKpis } from '@/lib/types';

const EMPTY_KPIS: HomeKpis = {
  followUps: null,
  tasks: null,
  leads: null,
  stock: null,
  errors: [],
  fromCache: false,
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { tokens, palette } = useTheme();
  const router = useRouter();
  const greeting = user?.full_name ?? user?.email ?? 'Dealer';

  const [kpis, setKpis] = useState<HomeKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayFollowUps, setTodayFollowUps] = useState<FollowUp[]>([]);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetchHomeKpis();
      setKpis(next);
      const [followResult, calendarResult] = await Promise.allSettled([
        listFollowUps({ limit: 8, todayOnly: true }),
        listCalendarEvents(),
      ]);
      if (followResult.status === 'fulfilled') {
        setTodayFollowUps(followResult.value.followUps.slice(0, 5));
      }
      if (calendarResult.status === 'fulfilled') {
        setTodayEvents(
          calendarResult.value.events
            .filter((event) => isSameLocalDay(event.dateIso))
            .slice(0, 5),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const metrics: MetricStripItem[] = [
    { key: 'followUps', label: 'Follow-ups', value: kpis.followUps },
    { key: 'tasks', label: 'Tasks', value: kpis.tasks },
    { key: 'leads', label: 'Leads', value: kpis.leads },
    { key: 'stock', label: 'Stock', value: kpis.stock },
  ];

  const onPressMetric = (key: string) => {
    switch (key) {
      case 'followUps':
        router.push('/follow-ups');
        break;
      case 'tasks':
        router.push('/tasks');
        break;
      case 'leads':
        router.push('/(tabs)/pipeline');
        break;
      case 'stock':
        router.push('/(tabs)/stock');
        break;
      default:
        break;
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
        <Title>Home</Title>
        <Body style={styles.lede}>Hello, {greeting}.</Body>

        {kpis.fromCache ? <OfflineBanner /> : null}

        {loading && !refreshing ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : (
          <MetricStrip metrics={metrics} onPressMetric={onPressMetric} />
        )}

        {kpis.errors.length > 0 ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message="Some live counts are unavailable. Pull to refresh." />
          </View>
        ) : null}

        <View style={styles.gap} />
        <AskFlashButton />

        {todayFollowUps.length > 0 ? (
          <View style={styles.section}>
            <Body style={[styles.sectionLabel, { color: tokens.text }]}>
              Today’s follow-ups
            </Body>
            {todayFollowUps.map((item) => (
              <ListRow
                key={item.id}
                title={followUpTitle(item)}
                meta={item.customer?.name ?? item.priority}
                chip={item.status}
                onPress={() => router.push('/follow-ups')}
              />
            ))}
          </View>
        ) : null}

        {todayEvents.length > 0 ? (
          <View style={styles.section}>
            <Body style={[styles.sectionLabel, { color: tokens.text }]}>Today’s schedule</Body>
            {todayEvents.map((item) => (
              <ListRow
                key={item.id}
                title={item.title}
                meta={item.subtitle}
                chip={item.status}
                onPress={() => {
                  router.push(item.href as Href);
                }}
              />
            ))}
          </View>
        ) : null}

        <Body style={[styles.foot, { color: tokens.textMuted }]}>
          Tap a metric to open that list. Pull down to refresh.
        </Body>
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
    paddingTop: 8,
    paddingBottom: 32,
  },
  lede: {
    marginTop: 4,
    marginBottom: 16,
  },
  loading: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    marginTop: 12,
  },
  gap: {
    height: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  foot: {
    marginTop: 16,
    fontSize: 13,
  },
});
