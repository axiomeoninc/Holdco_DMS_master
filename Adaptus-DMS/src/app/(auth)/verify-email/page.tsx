"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [purpose] = useState<"signup" | "login">(
    searchParams.get("purpose") === "login" ? "login" : "signup"
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/otp/verify", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), code: code.trim(), purpose },
      });
      toast.success("Email verified", "You can sign in now");
      router.push("/login");
    } catch (err: unknown) {
      const message =
        (err as { data?: { error?: string }; message?: string })?.data?.error ||
        (err as { message?: string })?.message ||
        "Verification failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      await apiFetch("/api/auth/otp/send", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), purpose },
        // Page owns honesty toasts (503 missing Resend must not look like success)
        silent: true,
        silent5xx: true,
      });
      toast.success("Code sent", "Check your inbox");
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string; missing_config?: boolean } })?.data;
      const message =
        data?.error ||
        (err as { message?: string })?.message ||
        "Could not send code";
      const honest = data?.missing_config
        ? "Not configured — add RESEND_API_KEY / EMAIL_FROM via wrangler when ready."
        : message;
      setError(honest);
      toast.error("Resend failed", honest);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <BrandLogo variant="lockup" size="md" href="/login" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code we sent. Codes expire in 15 minutes.
          </p>
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
            If Resend is not set on the Worker, Resend code returns an honest
            error — not configured; add via wrangler when ready.
          </p>
        </div>
        <form onSubmit={verify} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive-50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Verify and continue
          </Button>
        </form>
        <Button type="button" variant="outline" className="w-full" loading={resending} onClick={resend}>
          Resend code
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
