"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

type LeadFormProps = {
  dealershipId: string;
  slug: string;
  dealershipName: string;
  /** Optional interest preset (stock number / vehicle label). */
  initialVehicleId?: string | null;
};

export default function ShowroomLeadForm({
  dealershipId,
  slug,
  dealershipName,
  initialVehicleId,
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleId, setVehicleId] = useState(initialVehicleId || "");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || done) return;
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Please add an email or phone number so we can reply.");
      return;
    }
    if (!consent) {
      setError("Please agree to be contacted about your inquiry.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/showroom/${encodeURIComponent(slug)}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealership_id: dealershipId,
          name,
          email,
          phone,
          interest_vehicle_id: vehicleId || null,
          notes: message || null,
          marketing_consent: consent,
          source: "Website",
          // Honest spam trap — bots fill hidden fields.
          website: honeypot,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "We couldn't submit your request — please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
        <h3 className="mt-3 text-lg font-semibold text-white">Request received</h3>
        <p className="mt-1 text-sm text-white/70">
          Thanks for reaching out to {dealershipName}. A team member will get back to you during
          business hours.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md"
    >
      <h3 className="text-base font-semibold text-white">Ask about a vehicle</h3>
      <p className="mt-1 text-xs text-white/60">
        We only use your info to reply to this inquiry. Consent is required for marketing contact.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-white/70">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
            placeholder="Your name"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-white/70">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-white/70">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
              placeholder="(555) 555-0123"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-white/70">Which vehicle?</span>
          <input
            type="text"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
            placeholder="Stock number or vehicle name (optional)"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-white/70">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
            placeholder="Anything we should know? (optional)"
          />
        </label>

        {/* Hidden honeypot — real users never see it. */}
        <input
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <label className="flex items-start gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-white/30 bg-white/10 accent-white"
          />
          <span>
            I agree to be contacted by {dealershipName} about this vehicle inquiry. You can revoke
            this anytime.
          </span>
        </label>

        {error && <p className="text-xs text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
