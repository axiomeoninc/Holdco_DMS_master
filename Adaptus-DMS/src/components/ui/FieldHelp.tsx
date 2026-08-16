"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip } from "@/src/components/ui/Tooltip";

export function FieldHelp({
    text,
    label,
}: {
    text: string;
    label?: string;
}) {
    return (
        <Tooltip content={text} side="top">
            <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={label ? `Help: ${label}` : "Field help"}
            >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            </button>
        </Tooltip>
    );
}
