import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Leave a review",
  robots: { index: false, follow: false },
};

export default async function ReviewLinkPage({ params }: PageProps) {
  const { token } = await params;

  const { data: request } = await supabaseAdmin
    .from("review_requests")
    .select(
      "id, token, status, review_url, customer_id, dealership_id, customer:customers(id, name), dealership:dealerships(id, business_name, name)"
    )
    .eq("token", token)
    .maybeSingle();

  if (!request) notFound();

  const customerName = (request.customer as { name?: string } | null)?.name || null;
  const dealershipName =
    (request.dealership as { business_name?: string | null; name?: string } | null)
      ?.business_name ||
    (request.dealership as { name?: string } | null)?.name ||
    "the dealership";

  // Clicking a review link marks the request as clicked (once). Public route —
  // idempotent, best-effort, never fails the page render.
  if (request.status !== "clicked" && request.status !== "reviewed") {
    void supabaseAdmin
      .from("review_requests")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("id", request.id);
  }

  const target =
    typeof request.review_url === "string" && request.review_url.trim()
      ? request.review_url.trim()
      : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-xl">
          ★
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          {customerName ? `Hi ${customerName},` : "Thanks for visiting"}
        </h1>
        <p className="mt-2 text-sm text-white/70">
          We&apos;d love to hear about your experience with {dealershipName}. Your review helps
          other shoppers make an informed decision.
        </p>

        {target ? (
          <a
            href={target}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-90"
          >
            Write a review
          </a>
        ) : (
          <p className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            This dealership hasn&apos;t set up a review destination yet. Please let them know you
            tried to leave a review.
          </p>
        )}

        <p className="mt-4 text-xs text-white/40">
          Powered by FlashFender · {dealershipName}
        </p>
      </div>
    </main>
  );
}
