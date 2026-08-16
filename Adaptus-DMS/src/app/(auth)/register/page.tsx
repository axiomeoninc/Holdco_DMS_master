"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dealership_name: "",
    slug: "",
    phone: "",
    website: "",
    address_street: "",
    address_city: "",
    address_province: "",
    address_postal: "",
    address_country: "CA",
    timezone: "America/Vancouver",
    business_number: "",
    admin_full_name: "",
    admin_email: "",
    admin_password: "",
    admin_phone: "",
    accept_terms: false,
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.accept_terms) {
      setError("You must accept Terms and Privacy to continue");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{
        data: {
          email: string;
          otp_sent: boolean;
          otp_error?: string;
          resend_configured?: boolean;
        };
        message?: string;
      }>("/api/auth/register-dealership", {
        method: "POST",
        body: form,
        silent: true,
      });
      if (res.data.otp_sent) {
        toast.success(
          "Dealership created",
          res.message || "Check your email for the verification code."
        );
      } else {
        // Honest path when Resend is missing — never claim the code was emailed
        toast.warning(
          "Dealership created — email not sent",
          res.data.otp_error ||
            res.message ||
            "Not configured — add RESEND_API_KEY / EMAIL_FROM via wrangler when ready."
        );
      }
      const q = new URLSearchParams({
        email: res.data.email,
        purpose: "signup",
      });
      router.push(`/verify-email?${q.toString()}`);
    } catch (err: unknown) {
      const message =
        (err as { data?: { error?: string }; message?: string })?.data?.error ||
        (err as { message?: string })?.message ||
        "Registration failed";
      setError(message);
      toast.error("Registration failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <BrandLogo
          variant="lockup"
          size="md"
          href={null}
          subtitle="Start your 7-day trial"
        />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Register your dealership</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Soft lock after 7 days — login stays open, writes pause, data kept. OTP required before
            first login.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          {error && (
            <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive-50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Dealership
            </h2>
            <Input label="Legal / display name" value={form.dealership_name} onChange={(e) => set("dealership_name", e.target.value)} required />
            <Input label="Public slug (optional)" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="nova-motors" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              <Input label="Website" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            <Input label="Street" value={form.address_street} onChange={(e) => set("address_street", e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="City" value={form.address_city} onChange={(e) => set("address_city", e.target.value)} />
              <Input label="Province / State" value={form.address_province} onChange={(e) => set("address_province", e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Postal" value={form.address_postal} onChange={(e) => set("address_postal", e.target.value)} />
              <Input label="Country" value={form.address_country} onChange={(e) => set("address_country", e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
              <Input label="GST/HST / business number (optional)" value={form.business_number} onChange={(e) => set("business_number", e.target.value)} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Owner admin
            </h2>
            <Input label="Full name" value={form.admin_full_name} onChange={(e) => set("admin_full_name", e.target.value)} required />
            <Input label="Work email" type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} required />
            <Input label="Phone" value={form.admin_phone} onChange={(e) => set("admin_phone", e.target.value)} />
            <Input
              label="Password (12+ chars, letters + numbers)"
              type="password"
              value={form.admin_password}
              onChange={(e) => set("admin_password", e.target.value)}
              required
            />
          </section>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.accept_terms}
              onChange={(e) => set("accept_terms", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span>I accept the Terms and Privacy Policy</span>
          </label>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {loading ? "Creating…" : "Create trial account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
