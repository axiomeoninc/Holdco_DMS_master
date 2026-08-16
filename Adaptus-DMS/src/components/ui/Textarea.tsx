"use client";

// src/components/ui/Textarea.tsx
// F-09 of v3 master plan. Like Input, but multi-line.

import { forwardRef, type TextareaHTMLAttributes, useId } from "react";
import { FieldHelp } from "@/src/components/ui/FieldHelp";

const cn = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    helper?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    {
        className = "",
        containerClassName = "",
        label,
        helper,
        hint,
        error,
        required = false,
        id: idProp,
        ...rest
    },
    ref
) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
    return (
        <div className={cn("space-y-1.5", containerClassName)}>
            {label && (
                <span className="flex items-center gap-1">
                    <label htmlFor={id} className="block text-sm font-medium text-foreground">
                        {label}
                        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
                    </label>
                    {hint ? <FieldHelp text={hint} label={label} /> : null}
                </span>
            )}
            <textarea
                ref={ref}
                id={id}
                aria-invalid={!!error}
                aria-describedby={describedBy}
                aria-required={required}
                className={cn(
                    "block w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                    "min-h-[80px] resize-y transition-colors",
                    "hover:border-foreground/25",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    error ? "border-destructive focus:ring-destructive" : "border-input focus:border-primary",
                    className
                )}
                {...rest}
            />
            {error ? (
                <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
                    {error}
                </p>
            ) : helper ? (
                <p id={`${id}-helper`} className="text-xs text-muted-foreground">
                    {helper}
                </p>
            ) : null}
        </div>
    );
});
