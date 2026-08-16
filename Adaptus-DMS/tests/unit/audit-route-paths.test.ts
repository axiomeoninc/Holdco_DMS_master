import { describe, expect, it } from "vitest";
import {
  API_ALLOWLIST,
  PAGE_ALLOWLIST,
  fileRelToUrl,
  isFullyStatic,
  matchesKnown,
  normalizePath,
  pathToPattern,
} from "../../scripts/lib/audit-route-paths.mjs";

describe("audit-route path helpers", () => {
  it("fileRelToUrl strips route groups and file name", () => {
    expect(
      fileRelToUrl("(dashboard)/platform/impersonate/page.tsx", "page")
    ).toBe("/platform/impersonate");
    expect(fileRelToUrl("api/platform/impersonate/route.ts", "api")).toBe(
      "/api/platform/impersonate"
    );
    expect(fileRelToUrl("page.tsx", "page")).toBe("/");
  });

  it("pathToPattern replaces dynamic segments", () => {
    expect(pathToPattern("/invoices/[id]/edit")).toBe(
      "/invoices/[param]/edit"
    );
    expect(isFullyStatic("/platform")).toBe(true);
    expect(isFullyStatic("/invoices/[id]")).toBe(false);
  });

  it("normalizePath rejects templates, assets, and non-absolute paths", () => {
    expect(normalizePath("/platform?x=1#y")).toBe("/platform");
    expect(normalizePath("/foo//bar/")).toBe("/foo/bar");
    expect(normalizePath("/logo.png")).toBeNull();
    expect(normalizePath("/_next/static/x")).toBeNull();
    expect(normalizePath("`/dynamic/${id}`")).toBeNull();
    expect(normalizePath("relative")).toBeNull();
  });

  it("matchesKnown uses exact set and [param] patterns", () => {
    const known = new Set(["/platform", "/customers"]);
    const patterns = ["/invoices/[param]", "/api/deals/[param]"];
    expect(matchesKnown("/platform", known, patterns)).toBe(true);
    expect(matchesKnown("/invoices/abc", known, patterns)).toBe(true);
    expect(matchesKnown("/missing", known, patterns)).toBe(false);
    expect(matchesKnown("/logo.png", known, patterns)).toBe(true); // ignored → true
  });

  it("exports allowlists used by audit script", () => {
    expect(PAGE_ALLOWLIST.has("/week")).toBe(true);
    expect(API_ALLOWLIST.has("/api/auth")).toBe(true);
  });
});
