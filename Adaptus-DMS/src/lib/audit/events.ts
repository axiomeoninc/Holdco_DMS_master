/**
 * Dealership-scoped audit events.
 *
 * The audit_logs table already exists (platform tier). This module provides a
 * typed, dealership-scoped event vocabulary + a single `logAudit` helper so
 * dealers get their own immutable audit trail for deal / inventory / lead /
 * settings changes.
 *
 * Immutability note: audit rows are never updated or deleted by the app. The
 * API surface for dealership audit logs is read-only (SELECT). Platform admins
 * retain full visibility via the existing platform policy.
 */

export type AuditEventAction =
    | "deal.create"
    | "deal.update"
    | "deal.close"
    | "deal.cancel"
    | "deal.sign"
    | "deal.payment"
    | "inventory.create"
    | "inventory.update"
    | "inventory.publish"
    | "inventory.sell"
    | "lead.create"
    | "lead.update"
    | "lead.status_change"
    | "lead.assign"
    | "settings.update"
    | "document.sign"
    | "document.export"
    | "payment.created"
    | "payment.succeeded"
    | "payment.refunded"
    | "retention.export"
    | "compliance.pack_generated";

export type AuditEntityType =
    | "deal"
    | "vehicle"
    | "lead"
    | "customer"
    | "invoice"
    | "bill_of_sale"
    | "quotation"
    | "settings"
    | "payment"
    | "document"
    | "retention_export";

export interface AuditEventInput {
    action: AuditEventAction;
    entity_type: AuditEntityType;
    entity_id?: string | null;
    actor_id?: string | null;
    actor_email?: string | null;
    actor_role?: string | null;
    target_id?: string | null;
    metadata?: Record<string, unknown>;
    dealership_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
}

/**
 * Insert a dealership-scoped audit row using the caller's Supabase client.
 *
 * Requires the RLS policy added in t1_esign_payments_retention.sql
 * (audit_logs_dealership_insert_policy) so a dealer's token client can write
 * rows scoped to their own dealership. Platform admins already pass via the
 * existing platform-admin policy + service-role client.
 */
export async function logAudit(
    supabase: {
        from: (table: string) => {
            insert: (row: Record<string, unknown>) => {
                select: () => {
                    single: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
                };
            };
        };
    },
    input: AuditEventInput
): Promise<{ id: string | null; error: string | null }> {
    const row: Record<string, unknown> = {
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id || null,
        actor_id: input.actor_id || null,
        actor_email: input.actor_email || null,
        actor_role: input.actor_role || null,
        target_id: input.target_id || null,
        metadata: input.metadata ?? {},
        dealership_id: input.dealership_id || null,
        ip_address: input.ip_address || null,
        user_agent: input.user_agent || null,
    };

    const { data, error } = await supabase
        .from("audit_logs")
        .insert(row)
        .select()
        .single();

    if (error) {
        console.error("[audit] logAudit failed:", error.message);
        return { id: null, error: error.message || "Failed to write audit log" };
    }

    const rec = (data || {}) as { id?: string };
    return { id: rec.id || null, error: null };
}
