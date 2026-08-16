import { test, expect } from "@playwright/test";
import { hasAuth, login, authSkipReason } from "./fixtures/auth";

/**
 * Public showroom. The page itself is unauthenticated; we resolve a valid
 * dealership slug through the authenticated API only to know where to look.
 */
test.describe("Showroom (public)", () => {
    test("unknown slug returns 404", async ({ page }) => {
        const res = await page.goto("/showroom/definitely-not-a-real-slug-xyz");
        // The app renders its 404 page (status may be 404 or a soft 404 page).
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText(/not found|404|page could not be found/i).first()
        ).toBeVisible();
        void res;
    });

    test("valid slug renders showroom with masked VIN + lead form", async ({
        page,
    }) => {
        if (!hasAuth) {
            test.skip(true, authSkipReason);
        }
        await login(page);

        // Resolve the dealership's public slug (read-only).
        const slug = await page
            .evaluate(async () => {
                const res = await fetch("/api/settings/business");
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                return json?.data?.slug || json?.slug || null;
            })
            .catch(() => null);

        if (!slug) {
            test.skip(true, "Dealership has no showroom slug configured");
        }

        await page.goto(`/showroom/${slug}`);
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/find your next vehicle/i);

        // Contact / lead capture surface.
        await expect(page.getByText(/contact/i).first()).toBeVisible();
        await expect(page.getByLabel(/name/i).first()).toBeVisible();

        // Privacy: a full 17-char VIN must never be rendered on the public page.
        // The JSON-LD, when present, carries only the masked form.
        await expect(page.getByText(/[A-HJ-NPR-Z0-9]{17}/i).first()).toHaveCount(0);

        const ld = page.locator('script[type="application/ld+json"]');
        if ((await ld.count()) > 0) {
            const text = await ld.textContent();
            if (text && text.includes("vehicleIdentificationNumber")) {
                expect(text).not.toMatch(/"[A-HJ-NPR-Z0-9]{17}"/);
            }
        }
    });
});
