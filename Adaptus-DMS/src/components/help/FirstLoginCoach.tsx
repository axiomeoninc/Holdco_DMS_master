"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import {
    readDeskTourStep,
    subscribeDeskTour,
    writeDeskTourStep,
} from "@/src/components/help/desk-help";

const STEPS = [
    {
        id: "dashboard",
        path: "/dashboard",
        title: "Your desk at a glance",
        body: "KPIs on top tell you what needs attention today. Click a metric to jump to the list.",
        nextHref: "/inventory",
        nextLabel: "See inventory",
    },
    {
        id: "inventory",
        path: "/inventory",
        title: "Stock lives here",
        body: "Add a vehicle, set price and status, and flag MVDA known damage before you publish Active.",
        nextHref: "/leads",
        nextLabel: "See leads",
    },
    {
        id: "leads",
        path: "/leads",
        title: "Follow the pipeline",
        body: "Leads and follow-ups keep the floor moving. Press ⌘K (Ctrl+K) anytime to search or start an action.",
        nextHref: null,
        nextLabel: "Start working",
    },
] as const;

export function FirstLoginCoach() {
    const pathname = usePathname() ?? "";
    const router = useRouter();
    const step = useSyncExternalStore(
        subscribeDeskTour,
        () => readDeskTourStep(STEPS.length),
        () => "done" as const
    );

    const dismiss = useCallback(() => {
        writeDeskTourStep("done");
    }, []);

    const advance = useCallback(() => {
        if (step === "done") return;
        const current = STEPS[step];
        if (!current) {
            dismiss();
            return;
        }
        if (current.nextHref) {
            const nextIndex = step + 1;
            writeDeskTourStep(nextIndex);
            router.push(current.nextHref);
            return;
        }
        dismiss();
    }, [dismiss, router, step]);

    if (step === "done") return null;

    const current = STEPS[step];
    if (!current) return null;
    if (pathname !== current.path && !pathname.startsWith(`${current.path}/`)) {
        return null;
    }

    return (
        <div
            className="pointer-events-none fixed inset-x-3 bottom-20 z-40 flex justify-start lg:bottom-5 lg:left-[17.5rem] lg:right-auto lg:inset-x-auto"
            role="dialog"
            aria-labelledby="desk-coach-title"
            aria-live="polite"
        >
            <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Step {step + 1} of {STEPS.length}
                    </p>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Skip tour"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
                <h2 id="desk-coach-title" className="mt-1 text-sm font-semibold text-foreground">
                    {current.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={dismiss}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                        Skip
                    </button>
                    <Button size="sm" onClick={advance}>
                        {current.nextLabel}
                        {current.nextHref ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                    </Button>
                </div>
            </div>
        </div>
    );
}
