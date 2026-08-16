/**
 * MVDA-style known-damage disclosure: block Active publish without notes.
 * Wave B / Phase 2 Lane B: Coming Soon → Active and Active edits share the same rule.
 * Status matching is case-insensitive; disclosure must be non-whitespace.
 */

export type DamageDisclosureInput = {
    status?: string | null;
    known_damage?: boolean | null;
    disclosure?: string | null;
};

export const MVDA_DAMAGE_NOTES_REQUIRED =
    "Known damage is flagged — add disclosure notes before publishing as Active (MVDA).";

export const MVDA_DISCLOSURE_RECOMMENDED =
    "Add Ontario MVDA disclosure notes before publishing as Active when known damage applies.";

export const MVDA_ACTIVE_CLEAR_BLOCKED =
    "Known damage is flagged — disclosure notes are required while status is Active (MVDA).";

function normalizeStatus(status?: string | null): string {
    return String(status ?? "")
        .trim()
        .toLowerCase();
}

export function isActiveInventoryStatus(status?: string | null): boolean {
    return normalizeStatus(status) === "active";
}

export function hasDisclosureNotes(disclosure?: string | null): boolean {
    return Boolean(String(disclosure ?? "").trim());
}

export function requiresDamageDisclosure(input: DamageDisclosureInput): boolean {
    return Boolean(input.known_damage) && isActiveInventoryStatus(input.status);
}

export function assertDamageDisclosureForPublish(input: DamageDisclosureInput): void {
    if (!requiresDamageDisclosure(input)) return;
    if (!hasDisclosureNotes(input.disclosure)) {
        throw new Error(MVDA_DAMAGE_NOTES_REQUIRED);
    }
}

/**
 * Resolve effective status / known_damage / disclosure when patching a vehicle
 * (new values overlay existing row).
 */
export function mergeDamageDisclosureState(
    existing: DamageDisclosureInput,
    patch: DamageDisclosureInput
): DamageDisclosureInput {
    return {
        status: patch.status !== undefined ? patch.status : existing.status,
        known_damage:
            patch.known_damage !== undefined
                ? patch.known_damage
                : existing.known_damage,
        disclosure:
            patch.disclosure !== undefined ? patch.disclosure : existing.disclosure,
    };
}

/** Soft check used by UI before publish — returns hard error message or null. */
export function disclosurePublishWarning(input: DamageDisclosureInput): string | null {
    try {
        assertDamageDisclosureForPublish(input);
        return null;
    } catch (e) {
        return e instanceof Error ? e.message : MVDA_DAMAGE_NOTES_REQUIRED;
    }
}

/**
 * UI helper: hard block when Active + damage + blank; soft recommend otherwise.
 */
export function disclosureDraftWarning(input: DamageDisclosureInput): string | null {
    if (!input.known_damage) return null;
    if (hasDisclosureNotes(input.disclosure)) return null;
    if (isActiveInventoryStatus(input.status)) {
        return MVDA_ACTIVE_CLEAR_BLOCKED;
    }
    return MVDA_DISCLOSURE_RECOMMENDED;
}
