"use client";

import { useState, useEffect, useRef } from "react";
import {
    User,
    Mail,
    Phone,
    Lock,
    Camera,
    Save,
    Loader2,
    AlertCircle,
    CheckCircle,
    Shield,
    Calendar,
} from "lucide-react";

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    role: string;
    start_date: string | null;
    created_at: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        phone: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch("/api/profile", {
                headers: {
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch profile");
            }

            const data = await response.json();
            setProfile(data.data);
            setFormData({
                full_name: data.data.full_name || "",
                email: data.data.email || "",
                phone: data.data.phone || "",
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
            if (data.data.avatar) {
                setAvatarPreview(data.data.avatar);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file");
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError("Image must be less than 2MB");
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validate password if provided
        if (formData.newPassword) {
            if (formData.newPassword.length < 6) {
                setError("New password must be at least 6 characters");
                return;
            }
            if (formData.newPassword !== formData.confirmPassword) {
                setError("Passwords do not match");
                return;
            }
        }

        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const payload: Record<string, unknown> = {
                full_name: formData.full_name,
                phone: formData.phone || null
            };

            // Add avatar if changed
            if (avatarPreview && avatarPreview.startsWith("data:")) {
                payload.avatar = avatarPreview;
            }

            // Add password if provided
            if (formData.newPassword) {
                payload.password = formData.newPassword;
            }

            const response = await fetch("/api/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to update profile");
            }

            setSuccessMessage("Profile updated successfully!");
            setFormData((prev) => ({
                ...prev,
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            }));

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage(null);
            }, 3000);

            // Refresh profile data
            fetchProfile();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    const formatDate = (date: string | null) => {
        if (!date) return "Not set";
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-500">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <p className="text-red-600 text-sm font-medium mb-2">Error loading profile</p>
                    <p className="text-gray-600 text-sm">{error}</p>
                    <button
                        onClick={fetchProfile}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl py-10">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    {successMessage}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h2>
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            {avatarPreview ? (
                                <img
                                    src={avatarPreview}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center border-4 border-gray-100">
                                    <User className="w-10 h-10 text-blue-600" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={triggerFileInput}
                                className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">Profile Photo</p>
                            <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
                            {avatarPreview && avatarPreview.startsWith("data:") && (
                                <p className="text-xs text-blue-600 mt-1">New photo selected - save to apply</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Personal Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <User className="w-4 h-4 text-gray-400" />
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Mail className="w-4 h-4 text-gray-400" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                placeholder="Email cannot be changed"
                            />
                            <p className="text-xs text-gray-400 mt-1">Email is managed by administrator</p>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Phone className="w-4 h-4 text-gray-400" />
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter phone number"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Shield className="w-4 h-4 text-gray-400" />
                                Role
                            </label>
                            <input
                                type="text"
                                value={profile?.role || "Staff"}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                Member Since
                            </label>
                            <input
                                type="text"
                                value={formatDate(profile?.created_at || null)}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                {/* Password Change */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
                    <p className="text-sm text-gray-500 mb-4">Leave password fields empty to keep your current password.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Lock className="w-4 h-4 text-gray-400" />
                                New Password
                            </label>
                            <input
                                type="password"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter new password"
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Lock className="w-4 h-4 text-gray-400" />
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Confirm new password"
                                minLength={6}
                            />
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
