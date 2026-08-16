/**
 * FlashFender email brand tokens — Workers-safe (no CSS imports).
 * Bolt cyan #00AEEF, FLASH red→orange gradient, charcoal body.
 */

export const FF = {
  bolt: "#00AEEF",
  boltDark: "#008FCB",
  flashRed: "#E11D2E",
  flashOrange: "#F97316",
  charcoal: "#1A1A1A",
  charcoalMuted: "#3D3D3D",
  ink: "#111111",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#F7F8FA",
  white: "#FFFFFF",
  success: "#059669",
} as const;

export const FF_COPY = {
  product: "FlashFender",
  productTag: "Dealer Management",
  supportEmail: "support@flashfender.com",
  defaultAppUrl: "https://app.flashfender.com",
} as const;

export function appBaseUrl(): string {
  const fromEnv =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return FF_COPY.defaultAppUrl;
}

export function moneyCad(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n) || 0);
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return escHtml(d);
  }
}
