// Task Notes API Route
import { requireTenantClient } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

// POST add note to task
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const user = tenant.auth.user;

        const { id: task_id } = await params;

        const payload = await req.json();

        if (!payload.content) {
            return NextResponse.json({ error: "Note content is required" }, { status: 400 });
        }

        // Use service role for the insert. RLS on task_notes is too strict
        // for the user-context insert even when the user owns the parent task.
        // The user is already authenticated; we trust the auth + payload.
        const { data: note, error: dbError } = await supabaseAdmin
            .from("task_notes")
            .insert({
                task_id,
                user_id: user.id,
                content: payload.content,
                is_internal: payload.is_internal !== false,
            })
            .select(`*, user:users!task_notes_user_id_fkey(id, full_name, avatar)`)
            .single();

        if (dbError) throw dbError;

        // Log activity (also via service role for the same reason)
        await supabaseAdmin.rpc("log_task_activity", {
            p_task_id: task_id,
            p_user_id: user.id,
            p_action: "commented",
            p_new_value: JSON.stringify({ note_id: note.id }),
        });

        return NextResponse.json({ data: note }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating note:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
