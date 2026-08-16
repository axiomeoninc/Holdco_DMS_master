import { describe, expect, it } from "vitest";
import {
  canCreate,
  canEdit,
  canDelete,
  hasActionPermission,
} from "@/src/lib/permission-middleware";

describe("is_platform_admin permission wildcard", () => {
  const perms: string[] = [];

  it("canCreate allows platform admin regardless of role", () => {
    expect(canCreate("Staff", perms, "vehicles", true)).toBe(true);
    expect(canCreate("Staff", perms, "vehicles", false)).toBe(false);
  });

  it("canEdit allows platform admin regardless of role", () => {
    expect(canEdit("Salesperson", perms, "leads", true)).toBe(true);
    expect(canEdit("Salesperson", perms, "leads", false)).toBe(false);
  });

  it("canDelete allows platform admin regardless of role", () => {
    expect(canDelete("Staff", perms, "invoices", true)).toBe(true);
    expect(canDelete("Staff", perms, "invoices", false)).toBe(false);
  });

  it("hasActionPermission treats platform admin as full access", () => {
    expect(
      hasActionPermission("Staff", perms, "customers", "write", true)
    ).toBe(true);
    expect(
      hasActionPermission("Staff", perms, "customers", "write", false)
    ).toBe(false);
  });
});
