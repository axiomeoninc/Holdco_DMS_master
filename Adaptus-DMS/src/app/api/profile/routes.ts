// app/api/profile/route.ts
import { getCurrentUser } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
    try {
        const { user, error } = await getCurrentUser(req);

        if (error || !user) {
            return NextResponse.json(
                { error: error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        //  Get full profile from users table
        const { data: profile, error: profileError } = await supabase
            .from("users")
            .select(`
        id,
        full_name,
        email,
        role,
        phone,
        avatar,
        start_date,
        created_at,
        updated_at
      `)
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            // User exists in auth but not in users table
            return NextResponse.json(
                {
                    error: "Profile not found",
                    details: "User exists in authentication but profile is missing",
                    user: {
                        id: user.id,
                        email: user.email
                    }
                },
                { status: 404 }
            );
        }

        //  Return profile with user info
        return NextResponse.json({
            data: profile,
            user: {
                id: user.id,
                email: user.email,
                confirmed_at: user.email_confirmed_at
            }
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("GET /api/profile error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 500 }
        );
    }
}