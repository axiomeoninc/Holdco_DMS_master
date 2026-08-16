import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeClient } from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe | AdaptUs DMS",
  description: "Email unsubscribe preference (CASL)",
};

/**
 * Public unsubscribe — token-verified preference write via /api/unsubscribe.
 */
export default function UnsubscribePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <Suspense
        fallback={
          <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
            Loading…
          </div>
        }
      >
        <UnsubscribeClient />
      </Suspense>
    </main>
  );
}
