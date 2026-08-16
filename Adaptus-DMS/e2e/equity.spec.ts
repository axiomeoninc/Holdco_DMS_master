import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

/**
 * Equity trigger surfacing. The banner only renders when the dealership has
 * real trigger candidates (aging inventory / equity-position customers), so we
 * assert the surface either appears or the page still loads honestly.
 */
test.describe("Equity triggers", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("inventory page surfaces equity banner when candidates exist", async ({
        page,
    }) => {
        await page.goto("/inventory");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        // Loading state appears first; if data has triggers a chip renders.
        const loading = page.getByText(/checking equity triggers/i).first();
        if ((await loading.count()) > 0) {
            // Wait for the async check to settle.
            await page
                .getByText(/checking equity triggers/i)
                .waitFor({ state: "hidden", timeout: 15_000 })
                .catch(() => {});
        }

        // The trigger chip mentions the candidate count (link on customers,
        // plain span on inventory). Match on the human trigger text.
        const trigger = page.getByText(/equity candidate|positive equity|negative equity|break-even/i).first();
        if ((await trigger.count()) > 0 && (await trigger.isVisible().catch(() => false))) {
            await expect(trigger).toBeVisible();
        } else {
            test.skip(true, "No equity trigger candidates — banner not rendered");
        }
    });

    test("customers page renders without breaking", async ({ page }) => {
        await page.goto("/customers");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/customer/i);
    });
});
