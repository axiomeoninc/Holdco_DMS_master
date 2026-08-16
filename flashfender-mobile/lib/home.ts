import { listFollowUps } from '@/lib/followUps';
import { listLeads } from '@/lib/leads';
import {
  CACHE_KEYS,
  isNetworkError,
  readCache,
  writeCache,
} from '@/lib/offlineCache';
import { listTasks } from '@/lib/tasks';
import type { HomeKpis } from '@/lib/types';
import { listVehicles } from '@/lib/vehicles';

function settledCount(
  result: PromiseSettledResult<{ count: number }>,
  label: string,
  errors: string[],
): number | null {
  if (result.status === 'fulfilled') return result.value.count;
  const message = 'unavailable';
  errors.push(`${label}: ${message}`);
  return null;
}

function allNetworkFailures(
  results: PromiseSettledResult<{ count: number }>[],
): boolean {
  return results.every(
    (result) =>
      result.status === 'rejected' && isNetworkError(result.reason),
  );
}

/** Parallel KPI counts from existing list APIs (honest nulls when a call fails). */
export async function fetchHomeKpis(): Promise<HomeKpis> {
  const errors: string[] = [];
  const settled = await Promise.allSettled([
    listFollowUps({ limit: 1, todayOnly: true }),
    listTasks({ limit: 1, myTasks: true }),
    listLeads({ limit: 1, skipCache: true }),
    listVehicles({ status: 'Active', limit: 1, skipCache: true }),
  ]);
  const [followUps, tasks, leads, stock] = settled;

  const kpis: HomeKpis = {
    followUps: settledCount(followUps, 'Follow-ups', errors),
    tasks: settledCount(tasks, 'Tasks', errors),
    leads: settledCount(leads, 'Leads', errors),
    stock: settledCount(stock, 'Stock', errors),
    errors,
    fromCache: false,
  };

  const anyValue =
    kpis.followUps !== null ||
    kpis.tasks !== null ||
    kpis.leads !== null ||
    kpis.stock !== null;

  if (anyValue) {
    await writeCache(CACHE_KEYS.homeKpis, {
      followUps: kpis.followUps,
      tasks: kpis.tasks,
      leads: kpis.leads,
      stock: kpis.stock,
      errors: [] as string[],
    });
    return kpis;
  }

  if (allNetworkFailures(settled)) {
    const cached = await readCache<HomeKpis>(CACHE_KEYS.homeKpis);
    if (cached) {
      return {
        followUps: cached.followUps ?? null,
        tasks: cached.tasks ?? null,
        leads: cached.leads ?? null,
        stock: cached.stock ?? null,
        errors: [],
        fromCache: true,
      };
    }
  }

  return kpis;
}
