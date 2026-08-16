/**
 * Lane 10 — offline MVDA helper checks (no DB).
 * Run: node scripts/_l10_mvda_unit.mjs
 */

function normalizeStatus(status) {
    return String(status ?? "").trim().toLowerCase();
}
function isActiveInventoryStatus(status) {
    return normalizeStatus(status) === "active";
}
function hasDisclosureNotes(disclosure) {
    return Boolean(String(disclosure ?? "").trim());
}
function requiresDamageDisclosure(input) {
    return Boolean(input.known_damage) && isActiveInventoryStatus(input.status);
}
const MVDA_DAMAGE_NOTES_REQUIRED =
    "Known damage is flagged — add disclosure notes before publishing as Active (MVDA).";
function assertDamageDisclosureForPublish(input) {
    if (!requiresDamageDisclosure(input)) return;
    if (!hasDisclosureNotes(input.disclosure)) {
        throw new Error(MVDA_DAMAGE_NOTES_REQUIRED);
    }
}
function mergeDamageDisclosureState(existing, patch) {
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

const cases = [];
function ok(name, cond) {
    cases.push([name, !!cond]);
    if (!cond) console.error("FAIL", name);
}

ok(
    "active normalize",
    isActiveInventoryStatus("ACTIVE") && isActiveInventoryStatus(" Active ")
);
ok(
    "requires when active+damage",
    requiresDamageDisclosure({
        status: "Active",
        known_damage: true,
        disclosure: "",
    })
);
ok(
    "no require when draft",
    !requiresDamageDisclosure({
        status: "Coming Soon",
        known_damage: true,
        disclosure: "",
    })
);
ok(
    "requires still true with notes (assert gates notes)",
    requiresDamageDisclosure({
        status: "Active",
        known_damage: true,
        disclosure: " prior repair ",
    })
);
try {
    assertDamageDisclosureForPublish({
        status: "Active",
        known_damage: true,
        disclosure: " prior repair ",
    });
    ok("assert passes with notes", true);
} catch {
    ok("assert passes with notes", false);
}
try {
    assertDamageDisclosureForPublish({
        status: "active",
        known_damage: true,
        disclosure: "  ",
    });
    ok("blank disclosure throws", false);
} catch (e) {
    ok("blank disclosure throws", e.message === MVDA_DAMAGE_NOTES_REQUIRED);
}
const merged = mergeDamageDisclosureState(
    { status: "Coming Soon", known_damage: true, disclosure: null },
    { status: "Active" }
);
ok(
    "merge overlays status",
    merged.status === "Active" && merged.known_damage === true
);

const failed = cases.filter(([, p]) => !p);
console.log(
    JSON.stringify(
        {
            passed: cases.length - failed.length,
            total: cases.length,
            failed: failed.map(([n]) => n),
        },
        null,
        2
    )
);
process.exit(failed.length ? 1 : 0);
