"use client";

import { useState, useEffect } from "react";
import {
    Key,
    Search,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle,
    Shield,
    Copy,
} from "lucide-react";

interface User {
    id: string;
    full_name: string;
    email: string;
    role: string;
    dealership_id: string;
    is_active: boolean;
}

export default function ResetPasswordPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const [resetting, setResetting] = useState<string | null>(null);
    const [tempPassword, setTempPassword] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            setLoading(true);
            setError(null);

            // Check if user is platform admin
            const meResponse = await fetch("/api/me", {
            });

            if (!meResponse.ok) throw new Error("Failed to get user info");
            const meData = await meResponse.json();
            if (!meData.data?.is_platform_admin) {
                setError("You do not have permission to access this feature");
                return;
            }

            const response = await fetch("/api/users?limit=50", {
            });

            if (!response.ok) throw new Error("Failed to fetch users");

            const data = await response.json();
            setUsers(data.data || []);
        } catch (err: unknown) {
            console.error("Error fetching users:", err);
            setError(err instanceof Error ? err.message : "Failed to load users");
        } finally {
            setLoading(false);
        }
    }

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!search.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const response = await fetch(`/api/users?q=${encodeURIComponent(search)}&limit=20`, {
            });

            if (!response.ok) throw new Error("Failed to search users");

            const data = await response.json();
            setSearchResults(data.data || []);
        } catch (err: unknown) {
            console.error("Error searching users:", err);
        } finally {
            setSearching(false);
        }
    }

    async function handleResetPassword(userId: string) {
        setResetting(userId);
        setError(null);
        setSuccess(null);
        setTempPassword(null);

        try {
            const response = await fetch("/api/platform/reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to reset password");
            }

            const data = await response.json();
            if (data.temporary_password) {
                setTempPassword(data.temporary_password);
            }
            setSuccess(`Password reset successfully for ${data.message?.replace("Password reset successfully for ", "")}`);
        } catch (err: unknown) {
            console.error("Error resetting password:", err);
            setError(err instanceof Error ? err.message : "Failed to reset password");
        } finally {
            setResetting(null);
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccess("Password copied to clipboard!");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Reset user passwords to provide temporary access
                    </p>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-blue-800">Security Notice</p>
                    <p className="text-blue-700 mt-1">
                        All password resets are logged for security and compliance purposes.
                        Share temporary passwords securely with the user through a verified channel.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {success && !tempPassword && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <p className="text-sm text-green-600">{success}</p>
                    </div>
                )}

                {tempPassword && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-blue-800">Temporary Password Generated</p>
                                <p className="text-sm text-blue-700 mt-1 font-mono bg-blue-100 px-3 py-2 rounded inline-block">
                                    {tempPassword}
                                </p>
                            </div>
                            <button
                                onClick={() => copyToClipboard(tempPassword)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                                <Copy className="w-4 h-4" />
                                Copy
                            </button>
                        </div>
                        <p className="text-xs text-blue-600 mt-3">
                            Share this password securely with the user. They should change it after logging in.
                        </p>
                    </div>
                )}

                {/* Search */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Search for User</h2>
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={searching}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                        </button>
                    </form>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {searchResults.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">{user.full_name || "Unnamed"}</p>
                                        <p className="text-sm text-gray-500">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={() => handleResetPassword(user.id)}
                                        disabled={resetting === user.id}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {resetting === user.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Resetting...
                                            </>
                                        ) : (
                                            <>
                                                <Key className="w-4 h-4" />
                                                Reset Password
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Users */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Recent Users</h2>
                        <button
                            onClick={fetchUsers}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-sm text-gray-500">No users found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.slice(0, 20).map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-gray-900">{user.full_name || "Unnamed"}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-500">{user.email}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                                    user.is_active ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
                                                }`}>
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleResetPassword(user.id)}
                                                    disabled={resetting === user.id}
                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                >
                                                    {resetting === user.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        "Reset Password"
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
