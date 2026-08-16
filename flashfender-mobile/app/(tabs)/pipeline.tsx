import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { AddDealSheet } from '@/components/AddDealSheet';
import { AddLeadSheet } from '@/components/AddLeadSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner, GoldButton, ListRow, OfflineBanner, Screen, Title, useTheme } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { leadTitle, listLeads } from '@/lib/leads';
import { LEAD_STATUSES, type Lead } from '@/lib/types';

export default function PipelineScreen() {
  const { tokens, palette } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [canAddLead, setCanAddLead] = useState(true);
  const [canAddDeal, setCanAddDeal] = useState(true);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [dealSheetOpen, setDealSheetOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | (typeof LEAD_STATUSES)[number]>(
    'All',
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await listLeads({ q: debouncedQuery, limit: 50 });
        setLeads(result.leads);
        setCount(result.count);
        setFromCache(result.fromCache === true);
      } catch (err) {
        setError(errorMessage(err));
        setFromCache(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Title>Pipeline</Title>
        {count > 0 ? (
          <Text style={[styles.count, { color: tokens.textMuted }]}>
            {count} {count === 1 ? 'lead' : 'leads'}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.push('/deals')}
        style={({ pressed }) => [
          styles.linkRow,
          {
            borderColor: tokens.border,
            backgroundColor: tokens.surface,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.linkLabel, { color: palette.primary }]}>View deals</Text>
      </Pressable>

      {(canAddLead || canAddDeal) ? (
        <View style={styles.addRow}>
          {canAddLead ? (
            <View style={styles.addBtn}>
              <GoldButton label="Add lead" onPress={() => setLeadSheetOpen(true)} />
            </View>
          ) : null}
          {canAddDeal ? (
            <View style={styles.addBtn}>
              <GoldButton label="Add deal" onPress={() => setDealSheetOpen(true)} />
            </View>
          ) : null}
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search leads"
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.search,
          {
            color: tokens.text,
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
          },
        ]}
      />

      <View style={styles.chips}>
        {(['All', ...LEAD_STATUSES] as const).map((item) => {
          const selected = statusFilter === item;
          return (
            <Pressable
              key={item}
              onPress={() => setStatusFilter(item)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? palette.primary : tokens.border,
                  backgroundColor: selected ? palette.primarySoft : tokens.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? palette.primary : tokens.text },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {fromCache ? (
        <View style={styles.errorWrap}>
          <OfflineBanner />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading && leads.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlashList
          data={
            statusFilter === 'All'
              ? leads
              : leads.filter((lead) => lead.status === statusFilter)
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={leads.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void load('refresh');
              }}
              tintColor={palette.primary}
            />
          }
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                title="No leads"
                body={
                  debouncedQuery.length > 0 || statusFilter !== 'All'
                    ? 'Nothing matched this search and status filter.'
                    : 'This dealership has no leads yet.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <ListRow
              title={leadTitle(item)}
              meta={[item.source, item.temperature].filter(Boolean).join(' · ') || null}
              chip={item.status}
              onPress={() =>
                router.push({
                  pathname: '/lead/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
        />
      )}

      <AddLeadSheet
        visible={leadSheetOpen}
        onClose={() => setLeadSheetOpen(false)}
        onCreated={(lead) => {
          setLeadSheetOpen(false);
          void load('refresh');
          router.push({
            pathname: '/lead/[id]',
            params: { id: lead.id },
          });
        }}
        onForbidden={() => {
          setCanAddLead(false);
          setLeadSheetOpen(false);
          setError('Adding leads is not allowed for this account (403).');
        }}
      />

      <AddDealSheet
        visible={dealSheetOpen}
        onClose={() => setDealSheetOpen(false)}
        onCreated={(deal) => {
          setDealSheetOpen(false);
          router.push({
            pathname: '/deal/[id]',
            params: { id: deal.id },
          });
        }}
        onForbidden={() => {
          setCanAddDeal(false);
          setDealSheetOpen(false);
          setError('Adding deals is not allowed for this account (403).');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  count: {
    fontSize: 13,
  },
  linkRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addBtn: {
    flex: 1,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorWrap: {
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 13,
  },
});
