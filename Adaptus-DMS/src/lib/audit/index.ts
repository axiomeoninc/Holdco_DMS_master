/**
 * Audit / retention / compliance module.
 * - Dealership-scoped immutable audit events (src/lib/audit/events.ts)
 * - Compliance document pack: We Owe / Buyer's Guide / Known-Damage (compliance.ts)
 * - Retention export builders (exports.ts)
 */

export * from "./events";
export * from "./compliance";
export * from "./exports";
