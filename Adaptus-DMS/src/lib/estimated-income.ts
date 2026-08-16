/** Estimated lot income = retail − purchase − extras − taxes − fixed pack. */
export function calcEstimatedIncome(input: {
    retail: number;
    purchase: number;
    extraCosts?: number;
    taxes?: number;
    fixedCosts?: number;
}): number {
    const retail = Number(input.retail) || 0;
    const purchase = Number(input.purchase) || 0;
    const extra = Number(input.extraCosts) || 0;
    const taxes = Number(input.taxes) || 0;
    const fixed = Number(input.fixedCosts) || 0;
    return retail - purchase - extra - taxes - fixed;
}

/** Default pack / recon when business settings are not wired yet. */
export const DEFAULT_FIXED_COSTS = 0;

export function daysInStock(createdAt: string | number | Date, nowMs?: number): number {
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) return 0;
    const now = nowMs ?? Date.now();
    return Math.max(0, Math.floor((now - created) / 86_400_000));
}
