"use client";

// Thin react-hook-form helpers — no full shadcn Form rewrite.

import {
    createContext,
    cloneElement,
    isValidElement,
    useContext,
    useId,
    type ComponentPropsWithoutRef,
    type ReactElement,
    type ReactNode,
} from "react";
import {
    Controller,
    FormProvider,
    useFormContext,
    type Control,
    type ControllerProps,
    type FieldPath,
    type FieldValues,
} from "react-hook-form";
import { cn } from "@/src/lib/utils";

export { useForm, useFormContext, useWatch, Controller } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";

export const Form = FormProvider;

type FormFieldContextValue = { name: string };

const FormFieldContext = createContext<FormFieldContextValue>({ name: "" });

export function FormField<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    );
}

export function useFormField() {
    const fieldContext = useContext(FormFieldContext);
    const { getFieldState, formState } = useFormContext();
    const fieldState = getFieldState(fieldContext.name, formState);
    const id = useId();
    return {
        id,
        name: fieldContext.name,
        formItemId: `${id}-form-item`,
        formDescriptionId: `${id}-form-item-description`,
        formMessageId: `${id}-form-item-message`,
        ...fieldState,
    };
}

export function FormItem({ className, ...props }: ComponentPropsWithoutRef<"div">) {
    return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function FormLabel({
    className,
    required,
    ...props
}: ComponentPropsWithoutRef<"label"> & { required?: boolean }) {
    const { formItemId, error } = useFormField();
    return (
        <label
            htmlFor={formItemId}
            className={cn(
                "block text-sm font-medium text-foreground",
                error && "text-destructive",
                className
            )}
            {...props}
        >
            {props.children}
            {required ? <span className="ml-0.5 text-destructive" aria-hidden>*</span> : null}
        </label>
    );
}

export function FormControl({ children }: { children: ReactNode }) {
    const { formItemId, formDescriptionId, formMessageId, error } = useFormField();
    if (isValidElement(children)) {
        return cloneElement(children as ReactElement<Record<string, unknown>>, {
            id: formItemId,
            "aria-describedby": error ? formMessageId : formDescriptionId,
            "aria-invalid": !!error,
        });
    }
    return <>{children}</>;
}

export function FormMessage({ className, ...props }: ComponentPropsWithoutRef<"p">) {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error.message ?? "") : props.children;
    if (!body) return null;
    return (
        <p
            id={formMessageId}
            className={cn("text-xs text-destructive", className)}
            role="alert"
            {...props}
        >
            {body}
        </p>
    );
}

export function FormDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
    const { formDescriptionId } = useFormField();
    return (
        <p
            id={formDescriptionId}
            className={cn("text-xs text-muted-foreground", className)}
            {...props}
        />
    );
}

/** Convenience typed control helper for zod-backed forms. */
export type AppFormControl<T extends FieldValues> = Control<T>;
