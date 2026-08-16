import Link from "next/link";
import { cn } from "@/src/lib/utils";

type BrandLogoProps = {
    /** Compact horizontal lockup (sidebar / mobile bar) */
    variant?: "lockup" | "stacked" | "mark";
    size?: "sm" | "md" | "lg";
    href?: string | null;
    subtitle?: string | null;
    className?: string;
    /** Invert wordmark for dark / primary panels */
    onDark?: boolean;
};

const MARK = "/brand/flashfender-mark.png";
const FULL = "/brand/flashfender-logo.png";

const MARK_PX = { sm: 28, md: 36, lg: 48 } as const;
const FULL_PX = { sm: 96, md: 140, lg: 200 } as const;

function Wordmark({
    size,
    onDark,
}: {
    size: "sm" | "md" | "lg";
    onDark?: boolean;
}) {
    return (
        <span
            className={cn(
                "font-bold tracking-tight leading-none",
                size === "sm" && "text-sm",
                size === "md" && "text-base",
                size === "lg" && "text-xl"
            )}
            aria-hidden
        >
            <span className="bg-flash-gradient bg-clip-text text-transparent">
                FLASH
            </span>
            <span className={onDark ? "text-white" : "text-charcoal"}>
                FENDER
            </span>
        </span>
    );
}

export function BrandLogo({
    variant = "lockup",
    size = "md",
    href = "/dashboard",
    subtitle = null,
    className,
    onDark = false,
}: BrandLogoProps) {
    const content =
        variant === "stacked" ? (
            <span className={cn("inline-flex flex-col items-center gap-1", className)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={FULL}
                    alt="FlashFender"
                    width={FULL_PX[size]}
                    height={FULL_PX[size]}
                    className="object-contain"
                    decoding="async"
                />
                {subtitle ? (
                    <span
                        className={cn(
                            "text-[10px] font-medium",
                            onDark ? "text-white/70" : "text-muted-foreground"
                        )}
                    >
                        {subtitle}
                    </span>
                ) : null}
            </span>
        ) : variant === "mark" ? (
            <span className={cn("inline-flex shrink-0", className)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={MARK}
                    alt="FlashFender"
                    width={MARK_PX[size]}
                    height={MARK_PX[size]}
                    className="rounded-md object-contain"
                    decoding="async"
                />
            </span>
        ) : (
            <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={MARK}
                    alt=""
                    width={MARK_PX[size]}
                    height={MARK_PX[size]}
                    className="shrink-0 rounded-md object-contain"
                    decoding="async"
                    aria-hidden
                />
                <span className="min-w-0">
                    <span className="block truncate">
                        <Wordmark size={size} onDark={onDark} />
                        <span className="sr-only">FlashFender</span>
                    </span>
                    {subtitle ? (
                        <span
                            className={cn(
                                "mt-0.5 block truncate text-[11px]",
                                onDark ? "text-white/70" : "text-muted-foreground"
                            )}
                        >
                            {subtitle}
                        </span>
                    ) : null}
                </span>
            </span>
        );

    if (href) {
        return (
            <Link
                href={href}
                className="inline-flex min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
                {content}
            </Link>
        );
    }

    return content;
}
