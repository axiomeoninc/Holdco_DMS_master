"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { toast } from "@/src/lib/toast";

type ImpersonationStatus = {
  active: boolean;
  target?: {
    id: string;
    email: string;
    full_name: string | null;
    role: string | null;
  };
  admin?: {
    id: string;
    email: string;
  };
};

export type ImpersonationBannerViewProps = {
  label: string;
  email?: string | null;
  showEmail?: boolean;
  exiting?: boolean;
  onExit?: () => void;
};

/** Presentational banner for Storybook / Chromatic (no Next router / fetch). */
export function ImpersonationBannerView({
  label,
  email,
  showEmail = false,
  exiting = false,
  onExit,
}: ImpersonationBannerViewProps) {
  return (
    <div
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 border-b border-[#00AEEF]/40 bg-[#00AEEF]/10 px-4 py-2.5 text-sm text-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex min-w-0 max-w-full items-center gap-2 font-medium">
        <Eye className="h-4 w-4 shrink-0 text-[#00AEEF]" aria-hidden />
        <span className="min-w-0 truncate">
          Viewing as{" "}
          <span className="font-semibold text-foreground">{label}</span>
          {showEmail && email ? (
            <span className="text-muted-foreground"> ({email})</span>
          ) : null}
        </span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="primary"
        onClick={onExit}
        disabled={exiting}
        className="shrink-0 bg-[#00AEEF] hover:bg-[#008FCB] active:bg-[#0077a8]"
      >
        {exiting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Exiting…
          </>
        ) : (
          <>
            <LogOut className="h-3.5 w-3.5" />
            Exit
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Sticky "Viewing as" strip when an impersonation stash cookie is present.
 * Hidden on /platform/* (middleware requires platform admin there).
 */
export function ImpersonationBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [exiting, setExiting] = useState(false);

  const onPlatform = pathname?.startsWith("/platform") ?? false;

  // Reset the banner state when moving to/from platform pages
  // (React 19 "adjust state during render" pattern).
  const [prevOnPlatform, setPrevOnPlatform] = useState(onPlatform);
  if (onPlatform !== prevOnPlatform) {
    setPrevOnPlatform(onPlatform);
    setStatus(null);
  }

  useEffect(() => {
    if (onPlatform) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/platform/impersonate", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as ImpersonationStatus;
        if (!cancelled) setStatus(data);
      } catch {
        // Banner is best-effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onPlatform, pathname]);

  if (onPlatform || !status?.active || !status.target) return null;

  const label =
    status.target.full_name?.trim() ||
    status.target.email ||
    "another user";

  async function handleExit() {
    setExiting(true);
    try {
      const res = await fetch("/api/platform/impersonate/exit", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to exit impersonation"
        );
      }
      toast.success("Restored platform admin session");
      window.location.assign(new URL("/platform", window.location.origin).href);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to exit impersonation"
      );
      setExiting(false);
    }
  }

  return (
    <ImpersonationBannerView
      label={label}
      email={status.target.email}
      showEmail={Boolean(status.target.email && status.target.full_name)}
      exiting={exiting}
      onExit={() => void handleExit()}
    />
  );
}
