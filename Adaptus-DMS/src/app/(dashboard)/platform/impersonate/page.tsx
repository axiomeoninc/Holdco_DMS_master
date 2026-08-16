"use client";

import { useState, useEffect } from "react";
import {
  UserCheck,
  Search,
  RefreshCw,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ConfirmDialog } from "@/src/components/ui/ConfirmDialog";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Avatar } from "@/src/components/ui/Avatar";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import {
  DataTableShell,
  DataTableScroll,
  DataTable,
  DataTableHead,
  DataTableHeaderRow,
  DataTableTh,
  DataTableBody,
  DataTableRow,
  DataTableTd,
} from "@/src/components/ui/DataTable";

interface ImpersonateUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  dealership_id: string;
  is_active: boolean;
  is_platform_admin?: boolean;
}

function impersonationTargets(list: ImpersonateUser[]): ImpersonateUser[] {
  return list.filter((u) => u.is_platform_admin !== true);
}

export default function ImpersonatePage() {
  const [users, setUsers] = useState<ImpersonateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ImpersonateUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<ImpersonateUser | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    void fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      setForbidden(false);

      const meResponse = await fetch("/api/me");
      if (!meResponse.ok) throw new Error("Failed to get user info");
      const meData = await meResponse.json();
      if (!meData.data?.is_platform_admin) {
        setForbidden(true);
        return;
      }

      const statusResponse = await fetch("/api/platform/impersonate", {
        credentials: "same-origin",
      });
      if (statusResponse.ok) {
        const statusData = (await statusResponse.json()) as {
          configured?: boolean;
        };
        if (statusData.configured === false) {
          setNotConfigured(true);
          return;
        }
      }
      setNotConfigured(false);

      const response = await fetch("/api/users?limit=50");
      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();
      setUsers(data.data || []);
    } catch (err: unknown) {
      console.error("Error fetching users:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load users"
      );
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
      const response = await fetch(
        `/api/users?q=${encodeURIComponent(search)}&limit=20`
      );
      if (!response.ok) throw new Error("Failed to search users");
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (err: unknown) {
      console.error("Error searching users:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to search users"
      );
    } finally {
      setSearching(false);
    }
  }

  const requestImpersonate = (user: ImpersonateUser) => {
    if (!user.is_active) return;
    setPendingUser(user);
    setConfirmOpen(true);
  };

  async function confirmImpersonate() {
    if (!pendingUser) return;
    setImpersonating(true);
    try {
      const response = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ targetUserId: pendingUser.id }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Failed to impersonate user";
        if (/impersonation is not configured/i.test(message)) {
          setNotConfigured(true);
        }
        throw new Error(message);
      }

      toast.success(
        `Viewing as ${data.target_user?.full_name || data.target_user?.email || "user"}`
      );
      window.location.assign(new URL("/dashboard", window.location.origin).href);
    } catch (err: unknown) {
      console.error("Error impersonating user:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to impersonate user"
      );
      setImpersonating(false);
      setConfirmOpen(false);
      setPendingUser(null);
    }
  }

  if (forbidden) {
    return (
      <ListPageShell
        title="Impersonate User"
        description="Access user accounts to troubleshoot or provide support"
        icon={UserCheck}
        breadcrumbs={[
          { label: "Platform", href: "/platform" },
          { label: "Impersonate" },
        ]}
      >
        <EmptyState
          kind="permission"
          title="Platform admin required"
          description="You do not have permission to access this feature."
        />
      </ListPageShell>
    );
  }

  if (notConfigured) {
    return (
      <ListPageShell
        title="Impersonate User"
        description="Access user accounts to troubleshoot or provide support"
        icon={UserCheck}
        breadcrumbs={[
          { label: "Platform", href: "/platform" },
          { label: "Impersonate" },
        ]}
      >
        <EmptyState
          kind="error"
          title="Impersonation is not configured"
          description="Session recovery is unavailable in this environment. Contact an operator to enable impersonation. Impersonation is disabled until then."
        />
      </ListPageShell>
    );
  }

  const displayList = impersonationTargets(
    searchResults.length > 0 ? searchResults : users.slice(0, 20)
  );

  return (
    <>
      <ListPageShell
        title="Impersonate User"
        description="Access user accounts to troubleshoot or provide support"
        icon={UserCheck}
        breadcrumbs={[
          { label: "Platform", href: "/platform" },
          { label: "Impersonate" },
        ]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchUsers()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
        toolbar={
          <form
            onSubmit={(e) => void handleSearch(e)}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={searching} size="md">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </form>
        }
      >
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-50 px-4 py-3 text-sm text-warning">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Important notice</p>
            <p className="mt-0.5 opacity-90">
              Impersonation swaps your session to the target user. All sessions
              are audited. Use only for support.
            </p>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : displayList.length === 0 ? (
          <EmptyState
            kind="no-results"
            title="No users found"
            description="Try a different search, or refresh the recent list."
          />
        ) : (
          <DataTableShell>
            <DataTableScroll>
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderRow>
                    <DataTableTh>User</DataTableTh>
                    <DataTableTh>Email</DataTableTh>
                    <DataTableTh>Role</DataTableTh>
                    <DataTableTh>Status</DataTableTh>
                    <DataTableTh className="text-right">Action</DataTableTh>
                  </DataTableHeaderRow>
                </DataTableHead>
                <DataTableBody>
                  {displayList.map((user) => (
                    <DataTableRow key={user.id}>
                      <DataTableTd>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={user.full_name || user.email}
                            size="sm"
                          />
                          <span className="font-medium text-foreground">
                            {user.full_name || "Unnamed"}
                          </span>
                        </div>
                      </DataTableTd>
                      <DataTableTd className="text-muted-foreground">
                        {user.email}
                      </DataTableTd>
                      <DataTableTd>
                        <span className="text-sm text-foreground">
                          {user.role}
                        </span>
                      </DataTableTd>
                      <DataTableTd>
                        <StatusBadge
                          status={user.is_active ? "Active" : "Inactive"}
                        />
                      </DataTableTd>
                      <DataTableTd className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!user.is_active || impersonating}
                          onClick={() => requestImpersonate(user)}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {user.is_active ? "Impersonate" : "Inactive"}
                        </Button>
                      </DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          </DataTableShell>
        )}
      </ListPageShell>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (impersonating) return;
          setConfirmOpen(open);
          if (!open) setPendingUser(null);
        }}
        severity="warning"
        title="Impersonate this user?"
        message="Your session will switch to theirs. Use Exit on the viewing banner to restore your admin session."
        detail={
          pendingUser
            ? `${pendingUser.full_name || "Unnamed"} · ${pendingUser.email}`
            : undefined
        }
        confirmLabel="Impersonate"
        loading={impersonating}
        onConfirm={() => void confirmImpersonate()}
      />
    </>
  );
}
