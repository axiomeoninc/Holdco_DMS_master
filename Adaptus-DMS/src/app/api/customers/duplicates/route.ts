import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";

function normalizePhone(phone: string | null | undefined): string {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
}

function normalizeEmail(email: string | null | undefined): string {
    if (!email) return "";
    return email.trim().toLowerCase();
}

function normalizeName(name: string | null | undefined): string {
    if (!name) return "";
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

type CustomerRow = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
};

/**
 * Find likely duplicate customer groups (email / phone / same name+contact).
 * Soft-deleted (Inactive) customers are excluded from matching by default.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
        }

        const dealershipId = auth.profile.dealership_id;
        if (!dealershipId && !auth.profile.is_platform_admin) {
            return NextResponse.json({ error: "No dealership context" }, { status: 403 });
        }

        const url = new URL(req.url);
        const adminDealership = url.searchParams.get("dealership_id");
        const target =
            auth.profile.is_platform_admin && adminDealership
                ? adminDealership
                : dealershipId;

        if (!target) {
            return NextResponse.json(
                { error: "dealership_id is required for platform admin duplicate scan" },
                { status: 400 }
            );
        }

        const includeInactive = url.searchParams.get("include_inactive") === "1";

        let query = supabaseAdmin
            .from("customers")
            .select(
                "id, name, email, phone, address, city, province, postal_code, status, notes, created_at, updated_at"
            )
            .eq("dealership_id", target)
            .order("created_at", { ascending: true })
            .limit(2000);

        if (!includeInactive) {
            query = query.eq("status", "Active");
        }

        const { data, error } = await query;
        if (error) throw error;

        const customers = (data || []) as CustomerRow[];
        const parent = new Map<string, string>();

        function find(id: string): string {
            const p = parent.get(id) || id;
            if (p !== id) {
                const root = find(p);
                parent.set(id, root);
                return root;
            }
            return id;
        }

        function union(a: string, b: string) {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(rb, ra);
        }

        customers.forEach((c) => parent.set(c.id, c.id));

        const byEmail = new Map<string, string[]>();
        const byPhone = new Map<string, string[]>();
        const byNameContact = new Map<string, string[]>();

        for (const c of customers) {
            const email = normalizeEmail(c.email);
            const phone = normalizePhone(c.phone);
            const name = normalizeName(c.name);

            if (email) {
                const list = byEmail.get(email) || [];
                list.push(c.id);
                byEmail.set(email, list);
            }
            if (phone.length >= 7) {
                const list = byPhone.get(phone) || [];
                list.push(c.id);
                byPhone.set(phone, list);
            }
            if (name && (email || phone.length >= 7)) {
                const key = `${name}|${email || phone}`;
                const list = byNameContact.get(key) || [];
                list.push(c.id);
                byNameContact.set(key, list);
            }
        }

        for (const ids of [...byEmail.values(), ...byPhone.values(), ...byNameContact.values()]) {
            if (ids.length < 2) continue;
            for (let i = 1; i < ids.length; i++) {
                union(ids[0]!, ids[i]!);
            }
        }

        const groupsMap = new Map<string, CustomerRow[]>();
        for (const c of customers) {
            const root = find(c.id);
            const list = groupsMap.get(root) || [];
            list.push(c);
            groupsMap.set(root, list);
        }

        const groups = [...groupsMap.values()]
            .filter((g) => g.length >= 2)
            .map((members) => {
                const reasons: string[] = [];
                const emails = new Set(
                    members.map((m) => normalizeEmail(m.email)).filter(Boolean)
                );
                const phones = new Set(
                    members.map((m) => normalizePhone(m.phone)).filter((p) => p.length >= 7)
                );
                if (emails.size === 1 && members.filter((m) => m.email).length >= 2) {
                    reasons.push("same email");
                }
                if (phones.size === 1 && members.filter((m) => normalizePhone(m.phone).length >= 7).length >= 2) {
                    reasons.push("same phone");
                }
                const names = new Set(members.map((m) => normalizeName(m.name)));
                if (names.size === 1) reasons.push("same name");

                return {
                    reason: reasons.join(", ") || "matched",
                    members: members.sort(
                        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    ),
                };
            })
            .sort((a, b) => b.members.length - a.members.length);

        return NextResponse.json({ data: groups, count: groups.length });
    } catch (error: unknown) {
        console.error("Error finding duplicate customers:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
