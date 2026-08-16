/**
 * Pure path helpers for route audit (shared by scripts/audit-routes.mjs + Vitest).
 */

/** Paths that look like app routes but are not (calendar units, OAuth, etc.). */
export const PAGE_ALLOWLIST = new Set([
  "/week",
  "/month",
  "/bi-week",
  "/edit",
  "/oauth/access_token",
  "/me/accounts",
]);

/** API path prefixes referenced without a leaf route (middleware matchers). */
export const API_ALLOWLIST = new Set(["/api/auth", "/api/webhooks"]);

export function isDynamicSegment(seg) {
  return /^\[(?:\.\.\.)?[^\]]+\]$/.test(seg);
}

/**
 * @param {string} relFromApp - path relative to src/app, posix slashes
 * @param {"page"|"api"} kind
 */
export function fileRelToUrl(relFromApp, kind) {
  let parts = relFromApp.replace(/\\/g, "/").split("/");
  parts = parts.slice(0, -1);
  parts = parts.filter((p) => {
    if (!p) return false;
    if (p.startsWith("(") && p.endsWith(")")) return false;
    if (p.startsWith("@")) return false;
    return true;
  });
  const url = "/" + parts.join("/");
  if (kind === "api") return url === "/" ? "/api" : url;
  return url === "/" ? "/" : url.replace(/\/+/g, "/");
}

export function pathToPattern(urlPath) {
  const segs = urlPath.split("/").filter(Boolean);
  return "/" + segs.map((s) => (isDynamicSegment(s) ? "[param]" : s)).join("/");
}

export function normalizePath(p) {
  if (!p || typeof p !== "string") return null;
  let s = p.trim();
  if (s.includes("${") || s.includes("`")) return null;
  if (s.includes("{") || s.includes("}")) return null;
  s = s.split("?")[0].split("#")[0];
  if (!s.startsWith("/")) return null;
  if (s.startsWith("//")) return null;
  if (s.startsWith("/_next") || s.startsWith("/favicon")) return null;
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff2?|ttf|pdf)$/i.test(s)) {
    return null;
  }
  s = s.replace(/\/+/g, "/");
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function matchesKnown(candidate, knownSet, knownPatterns) {
  const norm = normalizePath(candidate);
  if (!norm) return true;
  if (knownSet.has(norm)) return true;
  const noSlash = norm.replace(/\/$/, "") || "/";
  if (knownSet.has(noSlash)) return true;
  const candSegs = noSlash.split("/").filter(Boolean);
  for (const pattern of knownPatterns) {
    const patSegs = pattern.split("/").filter(Boolean);
    if (patSegs.length !== candSegs.length) continue;
    let ok = true;
    for (let i = 0; i < patSegs.length; i++) {
      if (patSegs[i] === "[param]") continue;
      if (patSegs[i] !== candSegs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function isFullyStatic(urlPath) {
  return !urlPath
    .split("/")
    .some((seg) => isDynamicSegment(seg) || seg.includes("["));
}
