import type { UserProfile } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

/** Best-effort dealership-scoped audit row for social actions. */
export async function logSocialAudit(opts: {
    action: string;
    entityType: string;
    entityId?: string | null;
    profile: UserProfile;
    dealershipId: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        await supabaseAdmin.rpc("log_audit_action", {
            p_action: opts.action,
            p_entity_type: opts.entityType,
            p_entity_id: opts.entityId || null,
            p_actor_id: opts.profile.id,
            p_metadata: {
                dealership_id: opts.dealershipId,
                ...(opts.metadata || {}),
            },
        });
    } catch (err) {
        // Fallback insert if RPC shape differs — never block the user flow
        try {
            await supabaseAdmin.from("audit_logs").insert({
                action: opts.action,
                entity_type: opts.entityType,
                entity_id: opts.entityId || null,
                actor_id: opts.profile.id,
                actor_email: opts.profile.email,
                actor_role: opts.profile.role,
                dealership_id: opts.dealershipId,
                metadata: {
                    dealership_id: opts.dealershipId,
                    ...(opts.metadata || {}),
                },
            });
        } catch (inner) {
            console.warn("[social] audit log failed:", err, inner);
        }
    }
}
