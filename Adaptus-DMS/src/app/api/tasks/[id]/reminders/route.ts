// Task Reminders API Route
import { requireTenantClient } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

// POST add reminder to task
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const user = tenant.auth.user;

        const { id: task_id } = await params;

        const payload = await req.json();

        if (!payload.remind_at) {
            return NextResponse.json({ error: "Reminder time is required" }, { status: 400 });
        }

        // Use service role: same RLS issue as task_notes — the user-context
        // insert is rejected even when the user owns the parent task.
        const { data: reminder, error: dbError } = await supabaseAdmin
            .from("task_reminders")
            .insert({
                task_id,
                user_id: user.id,
                remind_at: new Date(payload.remind_at).toISOString(),
                message: payload.message || null,
            })
            .select(`*`)
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({ data: reminder }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating reminder:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
