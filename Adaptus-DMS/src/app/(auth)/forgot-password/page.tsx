"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setWarning(null);
    try {
      const res = await apiFetch<{ ok: boolean; warning?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
        silent: true,
      });
      setDone(true);
      if (res.warning) {
        setWarning(res.warning);
        toast.error(
          "Email not configured",
          "Not configured — add RESEND_API_KEY / EMAIL_FROM via wrangler when ready."
        );
      } else {
        toast.success(
          "Check your email",
          "If that address is registered, a reset link was sent."
        );
      }
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message || "Request failed";
      toast.error("Request failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <BrandLogo variant="lockup" size="md" href="/login" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We will email a reset link if that address is registered.
          </p>
        </div>
        {done ? (
          <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
            <p>If that email is registered, a reset link was sent.</p>
            {warning && (
              <p className="text-amber-700 dark:text-amber-300">
                Not configured — add via wrangler when ready. ({warning})
              </p>
            )}
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
