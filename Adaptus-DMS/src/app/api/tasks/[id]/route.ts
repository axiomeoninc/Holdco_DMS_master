// Enhanced Single Task API Route
import { NextRequest, NextResponse } from "next/server";
import { assertOwnershipOrDeny, pickAllowed, requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

const TASK_ALLOWED_FIELDS = [
    "title", "description", "status", "priority", "due_date", "assigned_to",
    "customer_id", "lead_id", "deal_id",
    // Schema-actual columns used by the tasks table
    "reminder_at", "notes", "tags", "links",
] as const;

// GET single task with all related data
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        const { id } = await params;

        // Narrow fetch first to assert ownership
        const { data: existing, error: existingError } = await supabase
            .from("tasks")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json({ error: "Task not found" }, { status: 404 });
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Get task with relations
        const { data: task, error: dbError } = await supabase
            .from("tasks")
            .select(`
                *,
                assigned_user:users!tasks_assigned_to_fkey(id, full_name, email, avatar),
                created_by_user:users!tasks_created_by_fkey(id, full_name, email)
            `)
            .eq("id", id)
            .single();

        if (dbError) throw dbError;
        if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

        // Get notes
        const { data: notes } = await supabase
            .from("task_notes")
            .select(`*, user:users!task_notes_user_id_fkey(id, full_name, avatar)`)
            .eq("task_id", id)
            .order("created_at", { ascending: false });

        // Get attachments
        const { data: attachments } = await supabase
            .from("task_attachments")
            .select(`*, user:users!task_notes_user_id_fkey(id, full_name)`)
            .eq("task_id", id)
            .order("created_at", { ascending: false });

        // Get reminders
        const { data: reminders } = await supabase
            .from("task_reminders")
            .select(`*`)
            .eq("task_id", id)
            .order("remind_at", { ascending: true });

        // Get links
        const { data: links } = await supabase
            .from("task_links")
            .select(`*`)
            .eq("task_id", id);

        // Get activity
        const { data: activity } = await supabase
            .from("task_activity")
            .select(`*, user:users!task_notes_user_id_fkey(id, full_name)`)
            .eq("task_id", id)
            .order("created_at", { ascending: false })
            .limit(50);

        return NextResponse.json({
            data: {
                ...task,
                task_notes: notes || [],
                task_attachments: attachments || [],
                task_reminders: reminders || [],
                task_links: links || [],
                task_activity: activity || [],
            }
        });
    } catch (error: unknown) {
        console.error("Error fetching task:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}

// PATCH update task
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        const { id } = await params;
        const payload = await req.json();

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json({ error: "Task not found" }, { status: 404 });
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Whitelist the update payload and block dealership_id changes
        const safePayload = pickAllowed(payload, TASK_ALLOWED_FIELDS);
        delete (safePayload as { dealership_id?: unknown }).dealership_id;

        // Build update data
        const updateData: Record<string, unknown> = { ...safePayload };

        if (payload.due_date !== undefined) {
            updateData.due_date = payload.due_date ? new Date(payload.due_date).toISOString() : null;
        }
        if (payload.reminder_at !== undefined) {
            updateData.reminder_at = payload.reminder_at ? new Date(payload.reminder_at).toISOString() : null;
        }

        // Handle completion
        if (payload.status === 'Completed' && existing.status !== 'Completed') {
            updateData.completed_at = new Date().toISOString();
        } else if (payload.status && payload.status !== 'Completed') {
            updateData.completed_at = null;
        }

        const { data: task, error: dbError } = await supabase
            .from("tasks")
            .update(updateData)
            .eq("id", id)
            .select(`
                *,
                assigned_user:users!tasks_assigned_to_fkey(id, full_name, email, avatar),
                created_by_user:users!tasks_created_by_fkey(id, full_name, email)
            `)
            .single();

        if (dbError) throw dbError;

        // Update links if provided
        if (payload.links !== undefined) {
            await supabase.from("task_links").delete().eq("task_id", id);
            if (payload.links.length > 0) {
                const linkInserts = payload.links.map((link: { link_type: string; linked_id: string }) => ({
                    task_id: id,
                    link_type: link.link_type,
                    linked_id: link.linked_id,
                }));
                await supabase.from("task_links").insert(linkInserts);
            }
        }

        // Log activity
        const changes: Record<string, unknown> = {};
        if (payload.status !== undefined && payload.status !== existing.status) {
            changes.status_change = { from: existing.status, to: payload.status };
        }
        if (payload.assigned_to !== undefined && payload.assigned_to !== existing.assigned_to) {
            changes.assignment_change = { from: existing.assigned_to, to: payload.assigned_to };
        }
        if (payload.priority !== undefined && payload.priority !== existing.priority) {
            changes.priority_change = { from: existing.priority, to: payload.priority };
        }

        if (Object.keys(changes).length > 0) {
            await supabase.rpc("log_task_activity", {
                p_task_id: id,
                p_user_id: auth.user?.id,
                p_action: "updated",
                p_old_value: JSON.stringify(existing),
                p_new_value: JSON.stringify(changes),
            });
        }

        return NextResponse.json({ data: task });
    } catch (error: unknown) {
        console.error("Error updating task:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}

// DELETE task
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        const { id } = await params;

        const userRole = auth.profile.role;
        const userPerms = auth.profile?.user_permissions || [];
        const isPlatformAdmin = auth.profile.is_platform_admin;

        // Check tasks:delete permission
        const canDelete = isPlatformAdmin ||
            userRole === "Admin" ||
            userRole === "Manager" ||
            userPerms.includes("tasks:delete") ||
            userPerms.includes("*");

        if (!canDelete) {
            return NextResponse.json(
                { error: "Forbidden - You need tasks:delete permission to delete tasks" },
                { status: 403 }
            );
        }

        // Assert ownership before any write
        const { data: existing, error: existingError } = await supabase
            .from("tasks")
            .select("id, dealership_id, assigned_to")
            .eq("id", id)
            .single();

        if (existingError) {
            if (existingError.code === "PGRST116") {
                return NextResponse.json({ error: "Task not found" }, { status: 404 });
            }
            throw existingError;
        }

        const deny = assertOwnershipOrDeny(existing, auth.profile);
        if (deny) return deny;

        // Delete related records first (cascades should handle this, but being explicit)
        await supabase.from("task_reminders").delete().eq("task_id", id);
        await supabase.from("task_attachments").delete().eq("task_id", id);
        await supabase.from("task_notes").delete().eq("task_id", id);
        await supabase.from("task_links").delete().eq("task_id", id);
        await supabase.from("task_activity").delete().eq("task_id", id);

        const { error: dbError } = await supabase.from("tasks").delete().eq("id", id);

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting task:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
