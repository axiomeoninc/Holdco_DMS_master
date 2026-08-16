import { describe, expect, it } from "vitest";
import {
    buildIframeSnippet,
    buildPublicFacets,
    buildScriptSnippet,
    isDealershipEmbedBlocked,
    isDealershipPubliclyListed,
    maskVinForPublic,
    parsePublicYear,
    PUBLIC_INVENTORY_STATUS,
    publicVehicleQuerySpec,
    sanitizePublicExactFilter,
    sanitizePublicSearchQuery,
    vehicleCardHref,
} from "@/src/lib/public-inventory";
import {
    CSP,
    CSP_PUBLIC_EMBED,
    EMBED_FRAME_HEADERS,
    isPubliclyFrameablePath,
    securityHeadersForPath,
} from "@/src/lib/security-headers";

const DEALER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEALER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("sanitizePublicSearchQuery", () => {
    it("rejects empty and short queries", () => {
        expect(sanitizePublicSearchQuery(null)).toBeNull();
        expect(sanitizePublicSearchQuery("a")).toBeNull();
    });

    it("strips PostgREST metacharacters so q cannot break .or()", () => {
        expect(sanitizePublicSearchQuery("Civic),(id.neq.0")).toBe("Civic id.neq.0");
        expect(sanitizePublicSearchQuery("Ford%Civic\\(hack)")).toBe("Ford Civic hack");
    });
});

describe("public vehicle listing is Active-only and rooftop-scoped", () => {
    it("Coming Soon is never the public status", () => {
        expect(PUBLIC_INVENTORY_STATUS).toBe("Active");
        expect(publicVehicleQuerySpec(DEALER_A)).toEqual({
            dealershipId: DEALER_A,
            status: "Active",
        });
        expect(publicVehicleQuerySpec(DEALER_B).dealershipId).not.toBe(DEALER_A);
    });

    it("masks full VINs", () => {
        expect(maskVinForPublic("1HGCM82633A004352")).toBe("1HGC…4352");
        expect(maskVinForPublic("1HGCM82633A004352")).not.toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    });

    it("blocks cancelled rooftops from embed", () => {
        expect(isDealershipEmbedBlocked("Cancelled")).toBe(true);
        expect(isDealershipEmbedBlocked("Suspended")).toBe(true);
        expect(isDealershipEmbedBlocked("Active")).toBe(false);
        expect(isDealershipPubliclyListed("Active")).toBe(true);
        expect(isDealershipPubliclyListed("Cancelled")).toBe(false);
    });
});

describe("facets and year filter", () => {
    it("builds makes/models/years from Active rows only in the payload passed in", () => {
        const facets = buildPublicFacets([
            { year: 2021, make: "Honda", model: "Civic" },
            { year: 2019, make: "Honda", model: "Accord" },
            { year: 2021, make: "Toyota", model: "Camry" },
        ]);
        expect(facets.makes).toEqual(["Honda", "Toyota"]);
        expect(facets.modelsByMake.Honda).toEqual(["Accord", "Civic"]);
        expect(facets.years).toEqual([2021, 2019]);
    });

    it("parses year and strips injection from exact make", () => {
        expect(parsePublicYear("2020")).toBe(2020);
        expect(parsePublicYear("99")).toBeNull();
        expect(sanitizePublicExactFilter("Honda),(x")).toBe("Hondax");
    });
});

describe("vehicleCardHref", () => {
    it("defaults to hosted VDP", () => {
        expect(
            vehicleCardHref({
                origin: "https://app.flashfender.com",
                vehicleId: "veh-1",
            })
        ).toBe("https://app.flashfender.com/embed/vehicles/veh-1");
    });

    it("uses dealer VDP base when set", () => {
        expect(
            vehicleCardHref({
                origin: "https://app.flashfender.com",
                vehicleId: "veh-1",
                vdpBase: "https://dealer.example/stock",
            })
        ).toBe("https://dealer.example/stock/veh-1");
    });

    it("uses hosted showroom when data-vdp=showroom", () => {
        expect(
            vehicleCardHref({
                origin: "https://app.flashfender.com",
                vehicleId: "veh-1",
                vdpMode: "showroom",
                slug: "nova-motors",
            })
        ).toBe(
            "https://app.flashfender.com/showroom/nova-motors?vehicle=veh-1"
        );
    });
});

describe("embed snippets", () => {
    it("script snippet includes rooftop token and hosted widget JS", () => {
        const html = buildScriptSnippet({
            origin: "https://app.flashfender.com",
            dealershipId: DEALER_A,
            token: "aix_test",
        });
        expect(html).toContain("data-dealership=\"" + DEALER_A + "\"");
        expect(html).toContain("data-token=\"aix_test\"");
        expect(html).toContain("/embed/inventory.js");
        expect(html).toContain("FlashFender");
        expect(html).not.toContain("AdaptUs");
    });

    it("iframe snippet points at /embed/inventory with token and auto-height", () => {
        const html = buildIframeSnippet({
            origin: "https://app.flashfender.com",
            token: "aix_test",
            dealershipId: DEALER_A,
        });
        expect(html).toContain("/embed/inventory?");
        expect(html).toContain("token=aix_test");
        expect(html).toContain("dealership_id=" + DEALER_A);
        expect(html).toContain("flashfender-embed-height");
    });
});

describe("frame-ancestors for public embed only", () => {
    it("allows framing embed and showroom", () => {
        expect(isPubliclyFrameablePath("/embed/inventory")).toBe(true);
        expect(isPubliclyFrameablePath("/embed/vehicles/abc")).toBe(true);
        expect(isPubliclyFrameablePath("/showroom/nova")).toBe(true);
        expect(isPubliclyFrameablePath("/inventory")).toBe(false);
        expect(isPubliclyFrameablePath("/api/vehicles")).toBe(false);
        expect(CSP).toContain("frame-ancestors 'none'");
        expect(CSP_PUBLIC_EMBED).toContain("frame-ancestors *");
        const embed = securityHeadersForPath("/embed/inventory");
        expect(embed.some((h) => h.key === "X-Frame-Options")).toBe(false);
        expect(
            EMBED_FRAME_HEADERS.find((h) => h.key === "Content-Security-Policy")?.value
        ).toContain("frame-ancestors *");
        const dash = securityHeadersForPath("/settings/website");
        expect(dash.some((h) => h.key === "X-Frame-Options" && h.value === "DENY")).toBe(
            true
        );
    });
});
