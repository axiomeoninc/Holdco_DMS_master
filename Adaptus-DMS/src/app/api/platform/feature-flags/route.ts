// app/api/platform/feature-flags/route.ts
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/src/lib/auth-helpers";

// GET all feature flags (platform admin only)
export async function GET(req: NextRequest) {
    try {
        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile || !auth.user) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;

        // Use supabaseAdmin to bypass RLS for feature_flags
        const { data, error: dbError } = await supabaseAdmin
            .from("feature_flags")
            .select("*")
            .order("name", { ascending: true });

        if (dbError) throw dbError;

        return NextResponse.json({ data: data || [] });
    } catch (error: unknown) {
        console.error("Error fetching feature flags:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update a feature flag (platform admin only)
export async function PATCH(req: NextRequest) {
    try {
        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile || !auth.user) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;

        const payload = await req.json();
        const { key, enabled, value } = payload;

        if (!key) {
            return NextResponse.json({ error: "Feature flag key is required" }, { status: 400 });
        }

        // Build update data
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (enabled !== undefined) updateData.enabled = enabled;
        if (value !== undefined) updateData.value = value;

        // Use supabaseAdmin to bypass RLS
        const { data, error: dbError } = await supabaseAdmin
            .from("feature_flags")
            .update(updateData)
            .eq("key", key)
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "PGRST116") {
                return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
            }
            throw dbError;
        }

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error updating feature flag:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// POST create a new feature flag (platform admin only)
export async function POST(req: NextRequest) {
    try {
        const auth = await requirePlatformAdmin(req);
        if (auth.error || !auth.profile || !auth.user) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }
        const supabase = supabaseAdmin;

        const payload = await req.json();
        const { key, name, enabled, value, description } = payload;

        if (!key || !name) {
            return NextResponse.json({ error: "Feature flag key and name are required" }, { status: 400 });
        }

        // Use supabaseAdmin to bypass RLS
        const { data, error: dbError } = await supabaseAdmin
            .from("feature_flags")
            .insert({
                key,
                name,
                enabled: enabled !== false,
                value: value !== undefined ? value : null,
                description: description || null,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return NextResponse.json({ error: "Feature flag with this key already exists" }, { status: 400 });
            }
            throw dbError;
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating feature flag:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
