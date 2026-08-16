"use client";

// Brand Blue / FLASH variants via CVA — outline, ghost, and premium are distinct.

import {
    cloneElement,
    forwardRef,
    isValidElement,
    type ButtonHTMLAttributes,
    type ReactElement,
    type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

const buttonVariants = cva(
    [
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-[color,background-color,border-color,box-shadow,opacity]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
    ].join(" "),
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600 active:bg-primary-700",
                primary:
                    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600 active:bg-primary-700",
                secondary:
                    "border border-border bg-secondary text-secondary-foreground hover:bg-muted active:bg-muted/80",
                outline:
                    "border border-border bg-transparent text-foreground shadow-none hover:border-foreground/25 hover:bg-muted/60 active:bg-muted",
                ghost:
                    "bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground active:bg-muted/80",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",
                link:
                    "bg-transparent px-0 text-primary underline-offset-4 shadow-none hover:underline active:opacity-80",
                premium:
                    "bg-flash-gradient text-white shadow-md shadow-[hsl(var(--flash-from)/0.25)] hover:opacity-90 active:opacity-80",
            },
            size: {
                sm: "min-h-8 h-8 gap-1.5 rounded-md px-3 text-[13px]",
                md: "min-h-9 h-9 gap-2 rounded-md px-3.5 text-sm",
                lg: "min-h-10 h-10 gap-2 rounded-md px-5 text-sm",
                icon: "min-h-9 min-w-9 h-9 w-9 rounded-md p-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    asChild?: boolean;
}

export { buttonVariants };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        className = "",
        variant = "default",
        size = "md",
        loading = false,
        disabled,
        leftIcon,
        rightIcon,
        children,
        type = "button",
        asChild = false,
        ...rest
    },
    ref
) {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild && isValidElement(children)) {
        const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
        return cloneElement(child, {
            className: cn(classes, child.props.className),
        });
    }

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={classes}
            {...rest}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
            {children}
            {!loading && rightIcon}
        </button>
    );
});
