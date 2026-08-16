"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link2, TrendingUp, Loader2 } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";

type TriggerData = {
    data: {
        inventory: {
            count: number;
            trigger_text: string;
            units: Array<{
                id: string;
                label: string;
                stock_number: string | null;
                days_in_stock: number;
                retail_price: number | null;
            }>;
        };
        customers: {
            count: number;
            trigger_text: string;
            records: Array<{
                customer_id: string;
                customer_name: string | null;
                deal_id: string;
                equity: number;
                class: string;
            }>;
        };
    };
};

/**
 * Equity trigger surfacing for inventory + CRM pages.
 * Amber "not ready" state if nothing computes yet; silent on auth errors.
 */
export function EquityTriggersBanner({
    mode,
    inventoryHref = "/inventory?aging=1",
    customersHref = "/customers",
}: {
    mode: "inventory" | "customers" | "both";
    inventoryHref?: string;
    customersHref?: string;
}) {
    const [data, setData] = useState<TriggerData["data"] | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await apiFetch<TriggerData>("/api/equity/triggers", {
                silent: true,
                silent5xx: true,
            });
            setData(res.data);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking equity triggers…
            </div>
        );
    }
    if (!data) return null;

    const showInventory = mode === "inventory" || mode === "both";
    const showCustomers = mode === "customers" || mode === "both";
    const hasAny =
        (showInventory && data.inventory.count > 0) ||
        (showCustomers && data.customers.count > 0);
    if (!hasAny) return null;

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {showInventory && data.inventory.count > 0 && (
                <RenderTrigger
                    href={inventoryHref}
                    className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                >
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{data.inventory.trigger_text}</span>
                </RenderTrigger>
            )}
            {showCustomers && data.customers.count > 0 && (
                <RenderTrigger
                    href={customersHref}
                    className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                >
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{data.customers.trigger_text}</span>
                </RenderTrigger>
            )}
        </div>
    );
}

/** Renders an anchor when a real href is provided, otherwise a plain span. */
function RenderTrigger({
    href,
    className,
    children,
}: {
    href: string;
    className: string;
    children: ReactNode;
}) {
    if (href && href !== "#") {
        return (
            <a href={href} className={className}>
                {children}
            </a>
        );
    }
    return <span className={className}>{children}</span>;
}
