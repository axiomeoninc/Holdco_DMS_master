/** localStorage draft for VehicleIntakeWizard (add mode). */

export const INTAKE_DRAFT_KEY = "adaptus:vehicle-intake-draft";

export interface IntakeDraftEnvelope {
    savedAt: number;
    stepIndex: number;
    form: Record<string, unknown>;
}

export function loadIntakeDraft(): IntakeDraftEnvelope | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(INTAKE_DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as IntakeDraftEnvelope;
        if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveIntakeDraft(stepIndex: number, form: Record<string, unknown>): void {
    if (typeof window === "undefined") return;
    try {
        const envelope: IntakeDraftEnvelope = {
            savedAt: Date.now(),
            stepIndex,
            form,
        };
        localStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify(envelope));
    } catch {
        // quota / private mode — ignore
    }
}

export function clearIntakeDraft(): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(INTAKE_DRAFT_KEY);
    } catch {
        // ignore
    }
}

export function suggestStockNumber(year: number, vin: string): string {
    const y = year || new Date().getFullYear();
    const tail = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
    return `STK-${y}-${tail}`;
}
