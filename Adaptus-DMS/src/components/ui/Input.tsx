"use client";

// src/components/ui/Input.tsx
// F-09 of v3 master plan. Form input + label + helper text + error state.

import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";
import { FieldHelp } from "@/src/components/ui/FieldHelp";

const cn = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    helper?: string;
    /** Short “?” tooltip next to the label (compliance / field meaning). */
    hint?: string;
    error?: string;
    required?: boolean;
    leftAddon?: ReactNode;
    rightAddon?: ReactNode;
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    {
        className = "",
        containerClassName = "",
        label,
        helper,
        hint,
        error,
        required = false,
        leftAddon,
        rightAddon,
        id: idProp,
        ...rest
    },
    ref
) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
    return (
        <div className={cn("min-w-0 space-y-1.5", containerClassName)}>
            {label && (
                <span className="flex items-center gap-1">
                    <label
                        htmlFor={id}
                        className="block text-sm font-medium text-foreground"
                    >
                        {label}
                        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
                    </label>
                    {hint ? <FieldHelp text={hint} label={label} /> : null}
                </span>
            )}
            <div className="relative flex">
                {leftAddon && (
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                        {leftAddon}
                    </span>
                )}
                <input
                    ref={ref}
                    id={id}
                    aria-invalid={!!error}
                    aria-describedby={describedBy}
                    aria-required={required}
                    className={cn(
                        "block w-full rounded-md border bg-card text-foreground placeholder:text-muted-foreground",
                        "min-h-9 h-9 px-3 text-sm shadow-none transition-colors",
                        "hover:border-foreground/25",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
                        "aria-[invalid=true]:border-destructive",
                        leftAddon ? "pl-9" : "",
                        rightAddon ? "pr-9" : "",
                        error
                            ? "border-destructive focus:ring-destructive"
                            : "border-input focus:border-primary",
                        className
                    )}
                    {...rest}
                />
                {rightAddon && (
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
                        {rightAddon}
                    </span>
                )}
            </div>
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
