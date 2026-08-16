"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export function UnsubscribeClient() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email")?.trim() || "";
  const tokenParam = searchParams.get("token")?.trim() || "";

  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const canSubmit = useMemo(() => Boolean(email.trim().includes("@")), [email]);

  async function submit(nextEmail: string, token: string | null) {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: nextEmail.trim(),
          ...(token ? { token } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Unsubscribe failed");
        return;
      }
      setStatus("done");
      setMessage(data.message || "You have been unsubscribed.");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  useEffect(() => {
    if (autoTried) return;
    if (emailParam && tokenParam) {
      setAutoTried(true);
      void submit(emailParam, tokenParam);
    }
  }, [autoTried, emailParam, tokenParam]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Unsubscribe</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        Stop marketing email (and SMS marketing consent) from FlashFender / AdaptUs DMS.
        Transactional messages about a purchase may still be sent when required by law. SMS
        delivery is not configured in this product yet.
      </p>

      {status === "done" ? (
        <p className="mt-6 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(email, tokenParam || null);
          }}
          className="mt-6 space-y-4"
        >
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </label>
          {status === "error" && message && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={!canSubmit || status === "loading"}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Updating…" : "Confirm unsubscribe"}
          </button>
        </form>
      )}

      <p className="mt-6 text-xs text-gray-400">
        AdaptUs DMS · CASL preference centre · Contact your dealership for account changes.
      </p>
    </div>
  );
}
