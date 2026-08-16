"use client";

// Identity header for RecordDrawer: avatar + large name + badges.

import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { cn } from "@/src/lib/utils";

export interface RecordHeaderProps {
    title: string;
    subtitle?: ReactNode;
    /** StatusBadge, source chip, etc. */
    badges?: ReactNode;
    avatarSrc?: string | null;
    avatarName?: string | null;
    /** Hide avatar (e.g. invoice # titles). */
    showAvatar?: boolean;
    className?: string;
    titleId?: string;
}

export function RecordHeader({
    title,
    subtitle,
    badges,
    avatarSrc,
    avatarName,
    showAvatar = true,
    className,
    titleId,
}: RecordHeaderProps) {
    return (
        <div className={cn("flex items-start gap-3", className)}>
            {showAvatar && (
                <Avatar
                    src={avatarSrc}
                    name={avatarName ?? title}
                    size="lg"
                    loading="eager"
                    className="mt-0.5"
                />
            )}
            <div className="min-w-0 flex-1">
                <h2
                    id={titleId}
                    className="truncate text-lg font-semibold tracking-tight text-foreground"
                >
                    {title}
                </h2>
                {subtitle && (
                    <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>
                )}
                {badges && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
                )}
            </div>
        </div>
    );
}
