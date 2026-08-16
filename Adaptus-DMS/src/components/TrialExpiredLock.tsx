"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/src/lib/fetch";
import { BrandLogo } from "@/src/components/BrandLogo";

type SubscriptionInfo = {
  status: string | null;
  soft_locked: boolean;
};

export function TrialExpiredLock() {
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: { subscription?: SubscriptionInfo | null } }>(
          "/api/me"
        );
        if (!cancelled) {
          setLocked(Boolean(res.data?.subscription?.soft_locked));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !locked) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo variant="stacked" size="md" href={null} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Trial ended</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your 7-day trial has ended. You can still sign in, but dashboard modules and
          writes are locked. Your data is retained.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          AdaptUs plan upgrades are handled by support — there is no self-serve SaaS
          charge from this screen. Email{" "}
          <a className="underline" href="mailto:support@adaptusgroup.ca">
            support@adaptusgroup.ca
          </a>
          .
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
