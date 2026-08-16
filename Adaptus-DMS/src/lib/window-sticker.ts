/**
 * Browser print helper for inventory window stickers (no PDF lib on CF Workers).
 * Opens a print window with vehicle merchandising fields only — no invented data.
 */

export interface WindowStickerVehicle {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    vin: string;
    stock_number?: string | null;
    odometer?: number | null;
    condition?: string | null;
    exterior_color?: string | null;
    interior_color?: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
    fuel_type?: string | null;
    body_type?: string | null;
    /** Schema field name used across AdaptUs vehicles */
    body_style?: string | null;
    retail_price?: number | null;
    features?: string[] | string | null;
    dealership_name?: string | null;
}

function money(n: number | null | undefined): string {
    if (n == null || Number.isNaN(Number(n)) || Number(n) <= 0) return "Ask";
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Number(n));
}

function featuresList(features: WindowStickerVehicle["features"]): string {
    if (!features) return "";
    if (Array.isArray(features)) return features.filter(Boolean).join(" · ");
    return String(features).trim();
}

function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Open a print-ready window sticker. Returns false if pop-up blocked. */
export function printWindowSticker(v: WindowStickerVehicle): boolean {
    if (typeof window === "undefined") return false;

    const ymm = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`.trim();
    const feats = featuresList(v.features);
    const dealer = v.dealership_name?.trim() || "Dealership";

    const rows: [string, string][] = [
        ["Stock #", v.stock_number?.trim() || "—"],
        ["VIN", v.vin],
        ["Condition", v.condition?.trim() || "—"],
        ["Odometer", v.odometer != null ? `${Number(v.odometer).toLocaleString()} km` : "—"],
        ["Exterior", v.exterior_color?.trim() || "—"],
        ["Interior", v.interior_color?.trim() || "—"],
        ["Transmission", v.transmission?.trim() || "—"],
        ["Drivetrain", v.drivetrain?.trim() || "—"],
        ["Fuel", v.fuel_type?.trim() || "—"],
        ["Body", (v.body_type || v.body_style)?.trim() || "—"],
    ];

    const specRows = rows
        .map(
            ([label, val]) =>
                `<tr><th>${esc(label)}</th><td>${esc(val)}</td></tr>`
        )
        .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Window sticker — ${esc(ymm)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, Segoe UI, sans-serif; margin: 0; padding: 16mm; color: #111; }
  .sheet { max-width: 180mm; margin: 0 auto; border: 2px solid #111; padding: 12mm; }
  .dealer { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #444; }
  h1 { font-size: 28px; margin: 8px 0 4px; line-height: 1.15; }
  .price { font-size: 36px; font-weight: 700; margin: 12px 0; color: #2563EB; }
  .price span { font-size: 14px; font-weight: 500; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 6px 0; border-bottom: 1px solid #ddd; font-size: 13px; }
  th { width: 34%; color: #555; font-weight: 600; }
  .feats { margin-top: 14px; font-size: 12px; line-height: 1.45; color: #333; }
  .foot { margin-top: 16px; font-size: 10px; color: #666; }
  @media print {
    body { padding: 8mm; }
    .sheet { border-color: #000; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="dealer">${esc(dealer)}</div>
    <h1>${esc(ymm)}</h1>
    <div class="price">${esc(money(v.retail_price))} <span>+ applicable taxes</span></div>
    <table>${specRows}</table>
    ${feats ? `<div class="feats"><strong>Features</strong><br/>${esc(feats)}</div>` : ""}
    <p class="foot">Window sticker for lot display. Price subject to change. Verify VIN and odometer on vehicle.</p>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
}
