/**
 * Shared helpers for the public inventory embed, iframe, and hosted VDP.
 * Only Active stock is public. Full VINs are never returned to callers.
 */

export const PUBLIC_INVENTORY_STATUS = "Active" as const;

/** PostgREST `.or()` / `.filter()` metacharacters we never interpolate raw. */
const SEARCH_UNSAFE = /[,()\\*%]/g;

export function sanitizePublicSearchQuery(
    raw: string | null | undefined
): string | null {
    if (!raw || typeof raw !== "string") return null;
    const cleaned = raw.replace(SEARCH_UNSAFE, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length < 2) return null;
    return cleaned.slice(0, 80);
}

/** Exact make/model filter — strip injection chars, keep names like Mercedes-Benz. */
export function sanitizePublicExactFilter(
    raw: string | null | undefined
): string | null {
    if (!raw || typeof raw !== "string") return null;
    const cleaned = raw.replace(SEARCH_UNSAFE, "").trim();
    if (!cleaned) return null;
    return cleaned.slice(0, 80);
}

export function parsePublicYear(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
    return n;
}

export type PublicFacets = {
    makes: string[];
    modelsByMake: Record<string, string[]>;
    years: number[];
};

export function buildPublicFacets(
    rows: Array<{ year?: unknown; make?: unknown; model?: unknown }>
): PublicFacets {
    const makes = new Set<string>();
    const years = new Set<number>();
    const modelsByMake: Record<string, Set<string>> = {};
    for (const row of rows) {
        const make = typeof row.make === "string" ? row.make.trim() : "";
        const model = typeof row.model === "string" ? row.model.trim() : "";
        const yearNum =
            typeof row.year === "number" ? row.year : Number(row.year);
        if (make) {
            makes.add(make);
            if (!modelsByMake[make]) modelsByMake[make] = new Set();
            if (model) modelsByMake[make].add(model);
        }
        if (Number.isFinite(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
            years.add(yearNum);
        }
    }
    const models: Record<string, string[]> = {};
    for (const [make, set] of Object.entries(modelsByMake)) {
        models[make] = [...set].sort((a, b) => a.localeCompare(b));
    }
    return {
        makes: [...makes].sort((a, b) => a.localeCompare(b)),
        modelsByMake: models,
        years: [...years].sort((a, b) => b - a),
    };
}

export function isDealershipPubliclyListed(
    status: string | null | undefined
): boolean {
    return status === "Active";
}

/** Public widget still works for live rooftops that are not cancelled/suspended. */
export function isDealershipEmbedBlocked(
    status: string | null | undefined
): boolean {
    return status === "Suspended" || status === "Cancelled";
}

export function maskVinForPublic(vin: string | null | undefined): string | null {
    if (!vin || typeof vin !== "string") return null;
    if (vin.length <= 8) return vin;
    return `${vin.slice(0, 4)}…${vin.slice(-4)}`;
}

/** Filters every public vehicle query must apply. Coming Soon / Sold never listed. */
export function publicVehicleQuerySpec(dealershipId: string): {
    dealershipId: string;
    status: typeof PUBLIC_INVENTORY_STATUS;
} {
    return { dealershipId, status: PUBLIC_INVENTORY_STATUS };
}

export function vehicleCardHref(opts: {
    origin: string;
    vehicleId: string;
    vdpBase?: string | null;
    vdpMode?: string | null;
    slug?: string | null;
}): string {
    const origin = opts.origin.replace(/\/$/, "");
    const id = encodeURIComponent(opts.vehicleId);
    const base = (opts.vdpBase || "").trim();
    if (base) {
        const stripped = base.replace(/\/$/, "");
        return `${stripped}${base.includes("?") ? "&" : "/"}${id}`;
    }
    if ((opts.vdpMode || "").toLowerCase() === "showroom" && opts.slug) {
        return `${origin}/showroom/${encodeURIComponent(opts.slug)}?vehicle=${id}`;
    }
    return `${origin}/embed/vehicles/${id}`;
}

export function buildScriptSnippet(opts: {
    origin: string;
    dealershipId: string;
    token: string;
    vdpBase?: string | null;
}): string {
    const vdpAttr = opts.vdpBase
        ? `\n  data-vdp-base="${opts.vdpBase.replace(/"/g, "")}"`
        : "";
    return `<!-- FlashFender inventory embed (WordPress: Custom HTML block) -->
<div
  data-adaptus-inventory
  data-dealership="${opts.dealershipId}"
  data-token="${opts.token}"${vdpAttr}
></div>
<script async src="${opts.origin}/embed/inventory.js"></script>`;
}

export function buildIframeSnippet(opts: {
    origin: string;
    token: string;
    dealershipId?: string;
}): string {
    const qs = new URLSearchParams({ token: opts.token });
    if (opts.dealershipId) qs.set("dealership_id", opts.dealershipId);
    const src = `${opts.origin}/embed/inventory?${qs.toString()}`;
    return `<iframe id="ff-inventory" src="${src}" title="Inventory" style="width:100%;min-height:480px;border:0" loading="lazy"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (!e.data || e.data.type !== "flashfender-embed-height") return;
  var f = document.getElementById("ff-inventory");
  if (f && typeof e.data.height === "number") f.style.height = Math.max(e.data.height, 320) + "px";
});
</script>`;
}
