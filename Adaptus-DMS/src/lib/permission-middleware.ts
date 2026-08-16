// src/lib/permission-middleware.ts
// Centralized permission checking helpers for API routes

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  effectivePermissions: string[],
  permission: string
): boolean {
  if (!effectivePermissions || !Array.isArray(effectivePermissions)) {
    return false;
  }

  // Full access wildcard
  if (effectivePermissions.includes("*")) {
    return true;
  }

  return effectivePermissions.includes(permission);
}

/**
 * Check if a user has action permission for a resource
 * Combines role-based and permission-based checks
 */
export function hasActionPermission(
  userRole: string,
  effectivePermissions: string[],
  resource: string,
  action: "read" | "write" | "delete" | "assign" | "export" | "read:assigned",
  isPlatformAdmin = false
): boolean {
  // Admin and Platform Admin have full access
  if (isPlatformAdmin || userRole === "Admin" || userRole === "PlatformAdmin") {
    return true;
  }

  // Build the permission string (e.g., "leads:write")
  const permission = `${resource}:${action}`;

  return hasPermission(effectivePermissions, permission);
}

/**
 * Check if user should be scoped to assigned records only
 * Used for Salesperson/Staff roles
 */
export function shouldScopeToAssigned(
  userRole: string,
  effectivePermissions: string[]
): boolean {
  if (userRole === "Salesperson" || userRole === "Staff") {
    return true;
  }

  // Check if user has :assigned variant but not the full read
  const hasAssignedPerm = effectivePermissions.some(
    (p) => p.includes(":assigned") && !effectivePermissions.includes(p.replace(":assigned", ""))
  );

  return hasAssignedPerm;
}

/**
 * Check if user can view all records (not just assigned)
 */
export function canViewAll(
  userRole: string,
  effectivePermissions: string[],
  isPlatformAdmin = false
): boolean {
  // Admin can view all
  if (isPlatformAdmin || userRole === "Admin") {
    return true;
  }

  // If user has wildcard, they can view all
  if (effectivePermissions.includes("*")) {
    return true;
  }

  // Check if user has the base :read permission without :assigned
  // This is a heuristic - proper implementation would check specific resources
  const hasReadWithoutAssigned = effectivePermissions.some(
    (p) => p.endsWith(":read") && !p.endsWith(":assigned")
  );

  return hasReadWithoutAssigned;
}

/**
 * Check if user can create a resource
 */
export function canCreate(
  userRole: string,
  effectivePermissions: string[],
  resource: string,
  isPlatformAdmin = false
): boolean {
  if (
    isPlatformAdmin ||
    userRole === "Admin" ||
    userRole === "Manager" ||
    userRole === "PlatformAdmin"
  ) {
    return true;
  }

  return hasPermission(effectivePermissions, `${resource}:write`);
}

/**
 * Check if user can edit a resource
 */
export function canEdit(
  userRole: string,
  effectivePermissions: string[],
  resource: string,
  isPlatformAdmin = false
): boolean {
  if (
    isPlatformAdmin ||
    userRole === "Admin" ||
    userRole === "Manager" ||
    userRole === "PlatformAdmin"
  ) {
    return true;
  }

  return hasPermission(effectivePermissions, `${resource}:write`);
}

/**
 * Check if user can delete a resource
 */
export function canDelete(
  userRole: string,
  effectivePermissions: string[],
  resource: string,
  isPlatformAdmin = false
): boolean {
  if (isPlatformAdmin || userRole === "PlatformAdmin") {
    return true;
  }
  if (userRole === "Admin") {
    return true;
  }

  if (userRole === "Manager") {
    // Manager can delete most things except users
    if (resource === "users") {
      return false;
    }
    return true;
  }

  return hasPermission(effectivePermissions, `${resource}:delete`);
}

/**
 * Check if user can export a resource
 */
export function canExport(
  userRole: string,
  effectivePermissions: string[],
  resource: string,
  isPlatformAdmin = false
): boolean {
  if (
    isPlatformAdmin ||
    userRole === "Admin" ||
    userRole === "Manager" ||
    userRole === "PlatformAdmin"
  ) {
    return true;
  }

  return hasPermission(effectivePermissions, `${resource}:export`);
}

/**
 * Get user's effective permissions, merging role and individual permissions
 * Note: This is a client-side helper. API routes should use the computed
 * effective_permissions from /api/me or compute it server-side
 */
export function getEffectivePermissions(
  userPermissions: string[],
  rolePermissions: string[]
): string[] {
  if (!rolePermissions || !Array.isArray(rolePermissions)) {
    return userPermissions || [];
  }

  // If role has full access, return only wildcard
  if (rolePermissions.includes("*")) {
    return ["*"];
  }

  // Merge role and user permissions
  const merged = [...rolePermissions];
  const permSet = new Set(rolePermissions);

  for (const perm of userPermissions || []) {
    if (!permSet.has(perm)) {
      merged.push(perm);
    }
  }

  return merged;
}
