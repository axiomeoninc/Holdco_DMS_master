"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Mail,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    Shield,
    CheckCircle2,
    ArrowRight,
    Sparkles,
} from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

const FEATURES = [
    { icon: Shield, label: "SOC 2 ready", sub: "Enterprise security baked in" },
    { icon: CheckCircle2, label: "99.99% uptime", sub: "Always-on for your team" },
    { icon: Sparkles, label: "Built for dealers", sub: "Inventory · CRM · Deals" },
];

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginForm />
        </Suspense>
    );
}

function LoginFallback() {
    return (
        <div className="min-h-dvh w-full bg-background text-foreground lg:grid lg:grid-cols-2">
            <div className="hidden lg:block" />
            <div className="flex min-h-dvh items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        </div>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = searchParams.get("next") || "/dashboard";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        emailInputRef.current?.focus();
    }, []);

    const validate = (): string | null => {
        if (!email.trim()) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email";
        if (!password) return "Password is required";
        if (password.length < 6) return "Password is too short";
        return null;
    };

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        try {
            await apiFetch("/api/auth/login", {
                method: "POST",
                body: { email: email.trim(), password, rememberMe },
                // Login owns its error UX (incl. EMAIL_NOT_VERIFIED → verify page)
                silent: true,
                noAutoRedirect: true,
            });
            toast.success("Welcome back", "Loading your dashboard…");
            router.push(nextPath);
            router.refresh();
        } catch (err: unknown) {
            const apiErr = err as {
                data?: { error?: string; code?: string };
                message?: string;
            };
            const code = apiErr?.data?.code;
            const message =
                apiErr?.data?.error ||
                apiErr?.message ||
                "Sign in failed — check your email and password";

            if (code === "EMAIL_NOT_VERIFIED") {
                setError("Email not verified. Check your inbox for the verification code.");
                toast.info("Verify your email", "Enter the code we sent, then sign in.");
                const q = new URLSearchParams({
                    email: email.trim().toLowerCase(),
                    purpose: "signup",
                });
                router.push(`/verify-email?${q.toString()}`);
                return;
            }

            if (
                message.toLowerCase().includes("invalid") ||
                message.toLowerCase().includes("credentials")
            ) {
                setError("Wrong email or password. Please try again.");
            } else {
                setError(message);
            }
            toast.error("Sign in failed", message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-dvh w-full bg-background text-foreground lg:grid lg:grid-cols-2">
            {/* ─── Left panel: hero ─── */}
            <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary to-primary-600 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
                {/* Decorative blobs */}
                <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-500/40 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary-700/40 blur-3xl" aria-hidden />

                <div className="relative z-10">
                    <BrandLogo
                        variant="stacked"
                        size="md"
                        href={null}
                        onDark
                        subtitle="Dealer Management"
                    />
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-display text-white">
                            Run your dealership with confidence.
                        </h1>
                        <p className="max-w-md text-lg text-white/80">
                            Inventory, leads, deals, and reports — in one place, designed for the way
                            your team actually works.
                        </p>
                    </div>

                    <ul className="space-y-3">
                        {FEATURES.map((f) => (
                            <li key={f.label} className="flex items-start gap-3 rounded-xl bg-white/10 p-3 backdrop-blur">
                                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                                    <f.icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{f.label}</p>
                                    <p className="text-xs text-white/70">{f.sub}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative z-10 text-xs text-white/60">
                    © {new Date().getFullYear()} Flash Fender Inc. All rights reserved.
                </p>
            </div>

            {/* ─── Right panel: form ─── */}
            <div className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-8">
                <div className="w-full max-w-sm space-y-8">
                    {/* Mobile-only brand */}
                    <BrandLogo
                        variant="lockup"
                        size="md"
                        href={null}
                        className="lg:hidden"
                        subtitle="Dealer Management"
                    />

                    <div>
                        <h2 className="text-h1 text-foreground">Sign in</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Welcome back. Enter your credentials to continue.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5" noValidate>
                        {error && (
                            <div
                                role="alert"
                                className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive-50 p-3 text-sm text-destructive"
                            >
                                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                                    !
                                </span>
                                <span>{error}</span>
                            </div>
                        )}

                        <Input
                            ref={emailInputRef}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            label="Email"
                            placeholder="[email protected]"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            leftAddon={<Mail className="h-4 w-4" />}
                            required
                            autoFocus
                        />

                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label
                                    htmlFor="password-input"
                                    className="text-sm font-medium text-foreground"
                                >
                                    Password
                                </label>
                                <a
                                    href="/forgot-password"
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    Forgot password?
                                </a>
                            </div>
                            <Input
                                id="password-input"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                leftAddon={<Lock className="h-4 w-4" />}
                                rightAddon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                }
                                required
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-1"
                            />
                            <span>Keep me signed in for 30 days</span>
                        </label>

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            loading={loading}
                            rightIcon={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
                        >
                            {loading ? "Signing in…" : "Sign in"}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        New dealership?{" "}
                        <a className="font-medium text-primary hover:underline" href="/register">
                            Start a 7-day trial
                        </a>
                    </p>

                    <p className="text-center text-xs text-muted-foreground">
                        By signing in you agree to our{" "}
                        <a className="font-medium text-primary hover:underline" href="#">
                            Terms
                        </a>{" "}
                        and{" "}
                        <a className="font-medium text-primary hover:underline" href="#">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}
