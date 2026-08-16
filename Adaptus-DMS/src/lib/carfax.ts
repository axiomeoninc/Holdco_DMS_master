/**
 * CARFAX integration helpers — env-gated, no fake keys.
 *
 * Modes:
 * 1. Upload PDF → storage URL on vehicle.carfax_report_url (always available when bucket exists)
 * 2. Partner VHR link → CARFAX_PARTNER_ID builds a Canada VHR deep-link
 * 3. Partner API fetch → CARFAX_API_KEY + CARFAX_API_URL call dealer report endpoint
 */

export type CarfaxEnvStatus = {
    upload_ready: boolean;
    partner_link_ready: boolean;
    api_fetch_ready: boolean;
    configured: boolean;
    status: "live" | "partial" | "url_only" | "missing_env";
    missing: string[];
    notes: string;
};

export function getCarfaxEnv(): CarfaxEnvStatus {
    const apiKey = process.env.CARFAX_API_KEY?.trim() || null;
    const apiUrl = process.env.CARFAX_API_URL?.trim() || null;
    const partnerId = process.env.CARFAX_PARTNER_ID?.trim() || null;
    const supabaseOk = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    );

    const partner_link_ready = Boolean(partnerId);
    const api_fetch_ready = Boolean(apiKey && apiUrl);
    const upload_ready = supabaseOk;

    const missing: string[] = [];
    if (!partnerId && !apiKey) missing.push("CARFAX_PARTNER_ID or CARFAX_API_KEY");
    if (apiKey && !apiUrl) missing.push("CARFAX_API_URL");
    if (apiUrl && !apiKey) missing.push("CARFAX_API_KEY");

    let status: CarfaxEnvStatus["status"] = "url_only";
    if (api_fetch_ready) status = "live";
    else if (partner_link_ready) status = "partial";
    else if (!upload_ready) status = "missing_env";

    const notes = api_fetch_ready
        ? "Partner API credentials present — fetch/attach available."
        : partner_link_ready
          ? "Partner ID set — can attach CARFAX Canada VHR link. PDF upload still works."
          : "No Carfax API secrets. Staff can upload PDFs; auto-fetch needs CARFAX_PARTNER_ID and/or CARFAX_API_KEY+CARFAX_API_URL.";

    return {
        upload_ready,
        partner_link_ready,
        api_fetch_ready,
        configured: upload_ready || partner_link_ready || api_fetch_ready,
        status,
        missing: status === "url_only" || status === "live" || status === "partial" ? [] : missing,
        notes,
    };
}

/** Public Canada VHR deep-link when a dealer partner id is configured. */
export function buildCarfaxCanadaVhrUrl(vin: string, partnerId?: string | null): string | null {
    const partner = (partnerId || process.env.CARFAX_PARTNER_ID || "").trim();
    const cleanVin = vin.trim().toUpperCase();
    if (!partner || !cleanVin || cleanVin.length < 11) return null;
    const params = new URLSearchParams({
        partner,
        vin: cleanVin,
    });
    return `https://vhr.carfax.ca/?${params.toString()}`;
}

export type CarfaxFetchResult =
    | {
          ok: true;
          report_url: string;
          source: "partner_link" | "partner_api";
          report_data?: Record<string, unknown>;
          ownership_count?: number | null;
          accident_count?: number | null;
          title_status?: string | null;
      }
    | {
          ok: false;
          code: "missing_env" | "invalid_vin" | "upstream_error";
          message: string;
          missing?: string[];
      };

/**
 * Attempt to obtain a report URL for a VIN.
 * Never invents credentials — degrades with a clear message.
 */
export async function fetchCarfaxReportForVin(vin: string): Promise<CarfaxFetchResult> {
    const cleanVin = vin.trim().toUpperCase();
    if (!cleanVin || cleanVin.length < 11) {
        return { ok: false, code: "invalid_vin", message: "VIN is required (at least 11 characters)" };
    }

    const apiKey = process.env.CARFAX_API_KEY?.trim();
    const apiUrl = process.env.CARFAX_API_URL?.trim();

    if (apiKey && apiUrl) {
        try {
            const url = new URL(apiUrl);
            url.searchParams.set("vin", cleanVin);
            const res = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: "application/json",
                },
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                return {
                    ok: false,
                    code: "upstream_error",
                    message: `Carfax API returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
                };
            }
            const json = (await res.json()) as Record<string, unknown>;
            const reportUrl =
                (typeof json.report_url === "string" && json.report_url) ||
                (typeof json.url === "string" && json.url) ||
                (typeof json.vhr_url === "string" && json.vhr_url) ||
                null;
            if (!reportUrl) {
                return {
                    ok: false,
                    code: "upstream_error",
                    message: "Carfax API response did not include a report URL",
                };
            }
            return {
                ok: true,
                report_url: reportUrl,
                source: "partner_api",
                report_data: json,
                ownership_count:
                    typeof json.ownership_count === "number" ? json.ownership_count : null,
                accident_count:
                    typeof json.accident_count === "number" ? json.accident_count : null,
                title_status: typeof json.title_status === "string" ? json.title_status : null,
            };
        } catch (err) {
            return {
                ok: false,
                code: "upstream_error",
                message: err instanceof Error ? err.message : "Carfax API request failed",
            };
        }
    }

    const partnerLink = buildCarfaxCanadaVhrUrl(cleanVin);
    if (partnerLink) {
        return {
            ok: true,
            report_url: partnerLink,
            source: "partner_link",
        };
    }

    return {
        ok: false,
        code: "missing_env",
        message:
            "Carfax auto-fetch is not configured. Upload a PDF, or set CARFAX_PARTNER_ID and/or CARFAX_API_KEY+CARFAX_API_URL.",
        missing: ["CARFAX_PARTNER_ID", "CARFAX_API_KEY", "CARFAX_API_URL"],
    };
}
