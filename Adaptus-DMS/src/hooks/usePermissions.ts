// src/hooks/usePermissions.ts
import { useState, useEffect } from "react";

interface UsePermissionsResult {
  userPermissions: string[];
  userRole: string;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  canWrite: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const response = await fetch("/api/me");
        if (response.ok) {
          const data = await response.json();
          setUserPermissions(data.data.user_permissions || []);
          setUserRole(data.data.role || "");
          setIsPlatformAdmin(data.data.is_platform_admin || false);
        }
      } catch (error) {
        console.error("Error fetching user permissions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (userRole === "Admin" || isPlatformAdmin) return true;
    if (userPermissions.includes("*")) return true;
    return userPermissions.includes(permission);
  };

  const canWrite = (resource: string): boolean => {
    if (userRole === "Admin" || isPlatformAdmin) return true;
    return userPermissions.includes(`${resource}:write`);
  };

  const canDelete = (resource: string): boolean => {
    if (userRole === "Admin" || isPlatformAdmin) return true;
    return userPermissions.includes(`${resource}:delete`);
  };

  return {
    userPermissions,
    userRole,
    isLoading,
    hasPermission,
    canWrite,
    canDelete,
    isAdmin: userRole === "Admin",
    isPlatformAdmin,
  };
}
