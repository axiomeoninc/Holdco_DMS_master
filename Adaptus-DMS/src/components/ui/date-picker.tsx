"use client";

// react-day-picker + date-fns — ISO (yyyy-MM-dd) value for filters/forms.

import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, isValid, parse, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/Button";

export type DatePickerProps = {
    value: string;
    onChange: (isoDate: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    id?: string;
};

function toDate(iso: string): Date | undefined {
    if (!iso) return undefined;
    const d = parseISO(iso);
    return isValid(d) ? d : undefined;
}

export function DatePicker({
    value,
    onChange,
    label,
    placeholder = "Pick a date",
    className,
    disabled,
    id: idProp,
}: DatePickerProps) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = toDate(value);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            {label ? (
                <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {label}
                </label>
            ) : null}
            <Button
                id={id}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-9 w-full justify-start gap-2 font-normal"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className={cn("truncate", !selected && "text-muted-foreground")}>
                    {selected ? format(selected, "MMM d, yyyy") : placeholder}
                </span>
            </Button>
            {open ? (
                <div
                    className="absolute left-0 z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg animate-fade-in"
                    role="dialog"
                    aria-label={label ?? "Choose date"}
                >
                    <DayPicker
                        mode="single"
                        selected={selected}
                        onSelect={(d) => {
                            onChange(d ? format(d, "yyyy-MM-dd") : "");
                            setOpen(false);
                        }}
                        defaultMonth={selected}
                        className="rdp-brand"
                    />
                    {value ? (
                        <button
                            type="button"
                            className="mt-1 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => {
                                onChange("");
                                setOpen(false);
                            }}
                        >
                            Clear
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

/** Parse typed input into ISO yyyy-MM-dd when valid. */
export function parseFlexibleDate(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const iso = parseISO(trimmed);
    if (isValid(iso) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return format(iso, "yyyy-MM-dd");
    }
    for (const pattern of ["MM/dd/yyyy", "M/d/yyyy", "yyyy-MM-dd"]) {
        const d = parse(trimmed, pattern, new Date());
        if (isValid(d)) return format(d, "yyyy-MM-dd");
    }
    return null;
}
