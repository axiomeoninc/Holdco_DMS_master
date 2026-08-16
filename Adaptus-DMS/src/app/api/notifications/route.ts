// app/api/notifications/route.ts — dealership-scoped feed for TopHeader bell
import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

export type AppNotification = {
    id: string;
    kind: "follow_up" | "task" | "invoice" | "lead";
    title: string;
    body: string;
    href: string;
    at: string | null;
    overdue: boolean;
};

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const supabase = supabaseAdmin;

        // Always dealership-scoped — never aggregate all tenants for platform admins.
        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId) {
            return NextResponse.json({
                data: [] as AppNotification[],
                unread: 0,
            });
        }

        const today = new Date().toISOString().split("T")[0]!;
        const items: AppNotification[] = [];

        const { data: invoices } = await supabase
            .from("invoices")
            .select("id, invoice_number, due_date, status, created_at")
            .eq("dealership_id", dealershipId)
            .in("status", ["Pending", "Overdue"])
            .lte("due_date", today)
            .order("due_date", { ascending: true })
            .limit(8);
        for (const inv of invoices || []) {
            items.push({
                id: `inv-${inv.id}`,
                kind: "invoice",
                title: `Invoice ${inv.invoice_number} overdue`,
                body: `Due ${inv.due_date} · ${inv.status}`,
                href: "/invoices",
                at: inv.due_date || inv.created_at,
                overdue: true,
            });
        }

        const { data: followUps } = await supabase
            .from("follow_ups")
            .select("id, title, follow_up_date, status, created_at")
            .eq("dealership_id", dealershipId)
            .neq("status", "Completed")
            .neq("status", "Cancelled")
            .lte("follow_up_date", today)
            .order("follow_up_date", { ascending: true })
            .limit(8);
        for (const fu of followUps || []) {
            const due = fu.follow_up_date as string | null;
            items.push({
                id: `fu-${fu.id}`,
                kind: "follow_up",
                title: fu.title || "Follow-up due",
                body: due ? `Due ${due}` : "Due",
                href: "/follow-ups",
                at: due || fu.created_at,
                overdue: Boolean(due && due < today),
            });
        }

        const taskHorizon = new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString();
        const { data: tasks } = await supabase
            .from("tasks")
            .select("id, title, due_date, status, created_at")
            .eq("dealership_id", dealershipId)
            .not("status", "in", '("Completed","Cancelled")')
            .not("due_date", "is", null)
            .lte("due_date", taskHorizon)
            .order("due_date", { ascending: true })
            .limit(8);
        for (const t of tasks || []) {
            const dueRaw = t.due_date ? String(t.due_date) : null;
            const dueDay = dueRaw ? dueRaw.slice(0, 10) : null;
            items.push({
                id: `task-${t.id}`,
                kind: "task",
                title: t.title || "Task due",
                body: dueDay ? `Due ${dueDay}` : "Due soon",
                href: "/tasks",
                at: dueRaw || t.created_at,
                overdue: Boolean(dueDay && dueDay < today),
            });
        }

        items.sort((a, b) => {
            const ta = a.at ? new Date(a.at).getTime() : 0;
            const tb = b.at ? new Date(b.at).getTime() : 0;
            return ta - tb;
        });

        const limited = items.slice(0, 20);

        return NextResponse.json({
            data: limited,
            unread: limited.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 }
        );
    }
}
