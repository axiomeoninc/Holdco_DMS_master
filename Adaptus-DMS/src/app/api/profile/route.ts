// app/api/profile/route.ts
import { getCurrentUser } from "@/src/lib/auth-helpers";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

// GET current user's profile
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

        // Get full user profile from users table
        const { data: profile, error: dbError } = await supabase
            .from("users")
            .select("id, avatar, full_name, role, email, phone, start_date, created_at, updated_at")
            .eq("id", user.id)
            .single();

        if (dbError) {
            // If user doesn't exist in users table, return auth user data
            if (dbError.code === "PGRST116") {
                return NextResponse.json({
                    data: {
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
                        avatar: user.user_metadata?.avatar || null,
                        role: "Staff",
                    }
                });
            }
            throw dbError;
        }

        return NextResponse.json({ data: profile });
    } catch (error: unknown) {
        console.error("Error fetching profile:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update current user's profile
export async function PATCH(req: NextRequest) {
    try {
        const { user, error } = await getCurrentUser(req);
        if (error || !user) {
            return NextResponse.json(
                { error: error || "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = supabaseAdmin;

        const payload = await req.json();

        // Handle password update separately via auth
        if (payload.password) {
            if (payload.password.length < 6) {
                return NextResponse.json(
                    { error: "Password must be at least 6 characters" },
                    { status: 400 }
                );
            }

            const { error: passwordError } = await supabase.auth.admin.updateUserById(user.id, {
                password: payload.password,
            });

            if (passwordError) {
                return NextResponse.json(
                    { error: passwordError.message || "Failed to update password" },
                    { status: 400 }
                );
            }
        }

        // Handle avatar upload
        if (payload.avatar && payload.avatar.startsWith("data:")) {
            // Upload base64 image to storage
            const avatarData = payload.avatar;
            const fileName = `${user.id}/${Date.now()}.jpg`;

            // Convert data URL to blob
            const response = await fetch(avatarData);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(fileName, blob, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            if (uploadError) {
                const msg = uploadError.message || "Avatar upload failed";
                const bucketMissing =
                    /bucket|not found|does not exist/i.test(msg);
                return NextResponse.json(
                    {
                        error: bucketMissing
                            ? "Avatar storage is not configured (missing 'avatars' bucket). Contact an administrator."
                            : `Avatar upload failed: ${msg}`,
                    },
                    { status: bucketMissing ? 503 : 500 }
                );
            }

            const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(fileName);

            payload.avatar = urlData.publicUrl;
        }

        // Allowed fields for profile update
        const allowedFields = ["full_name", "phone", "avatar"];
        const updateFields: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (payload[field] !== undefined) {
                updateFields[field] = payload[field];
            }
        }

        // Update user metadata in auth if needed
        if (updateFields.full_name || updateFields.avatar) {
            const metadataUpdate: Record<string, unknown> = {};
            if (updateFields.full_name) metadataUpdate.full_name = updateFields.full_name;
            if (updateFields.avatar) metadataUpdate.avatar = updateFields.avatar;

            await supabase.auth.admin.updateUserById(user.id, {
                user_metadata: metadataUpdate,
            });
        }

        // Update users table if there are fields to update
        if (Object.keys(updateFields).length > 0) {
            const { data, error: dbError } = await supabase
                .from("users")
                .update(updateFields)
                .eq("id", user.id)
                .select("id, avatar, full_name, role, email, phone, start_date, created_at, updated_at")
                .single();

            if (dbError && dbError.code !== "PGRST116") {
                throw dbError;
            }

            return NextResponse.json({
                data: data || {
                    id: user.id,
                    email: user.email,
                    ...updateFields
                },
                message: "Profile updated successfully"
            });
        }

        return NextResponse.json({
            data: { id: user.id, email: user.email },
            message: "Password updated successfully"
        });
    } catch (error: unknown) {
        console.error("Error updating profile:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
