"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/src/lib/fetch";

type SubscriptionInfo = {
  status: string | null;
  trial_ends_at: string | null;
  days_remaining: number | null;
  soft_locked: boolean;
};

export function TrialBanner() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: { subscription?: SubscriptionInfo | null } }>(
          "/api/me"
        );
        if (!cancelled) setSub(res.data?.subscription ?? null);
      } catch {
        // ignore — banner is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sub || sub.soft_locked) return null;
  if (sub.status !== "trialing" || sub.days_remaining == null) return null;

  const days = sub.days_remaining;
  const label =
    days <= 0
      ? "Trial ends today"
      : days === 1
        ? "Trial ends in 1 day"
        : `Trial ends in ${days} days`;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100">
      {label}. Full access during your trial — upgrade before it ends to keep writing.
    </div>
  );
}
