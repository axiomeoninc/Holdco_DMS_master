"use client";

// src/components/ui/Select.tsx
// F-09 of v3 master plan. Select wrapper.

import { forwardRef, type SelectHTMLAttributes, useId } from "react";

const cn = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
    label?: string;
    helper?: string;
    error?: string;
    required?: boolean;
    options?: SelectOption[];
    /** Use placeholder as a disabled empty option. */
    placeholder?: string;
    containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    {
        className = "",
        containerClassName = "",
        label,
        helper,
        error,
        required = false,
        options = [],
        placeholder,
        id: idProp,
        ...rest
    },
    ref
) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
    return (
        <div className={cn("min-w-0 w-full space-y-1.5", containerClassName)}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
                </label>
            )}
            <select
                ref={ref}
                id={id}
                aria-invalid={!!error}
                aria-describedby={describedBy}
                aria-required={required}
                className={cn(
                    "block min-w-0 w-full rounded-md border bg-card px-3 text-sm text-foreground transition-colors",
                    "min-h-9 h-9 pr-9 transition-[background-image,color,border-color]",
                    "hover:border-foreground/25",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "appearance-none bg-[length:1rem_1rem] bg-[right_0.65rem_center] bg-no-repeat",
                    "bg-[image:url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%2364748b%22><path%20fill-rule=%22evenodd%22%20d=%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.084l3.71-3.853a.75.75%200%20111.08%201.04l-4.25%204.4a.75.75%200%2001-1.08%200L5.21%208.27a.75.75%200%2001.02-1.06z%22%20clip-rule=%22evenodd%22/></svg>')]",
                    error ? "border-destructive focus:ring-destructive" : "border-input focus:border-primary",
                    className
                )}
                {...rest}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
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
