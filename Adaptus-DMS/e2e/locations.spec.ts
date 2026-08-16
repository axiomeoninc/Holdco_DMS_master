import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

test.describe("Locations", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("locations page loads", async ({ page }) => {
        await page.goto("/settings/locations");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/location/i);
    });

    test("CRUD surfaces when multi-location", async ({ page }) => {
        await page.goto("/settings/locations");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const addBtn = page.getByRole("button", { name: /add location/i });
        if ((await addBtn.count()) === 0) {
            // Single-location dealerships have no CRUD — honest skip.
            test.skip(true, "Single-location dealership — location CRUD not available");
        }
        await expect(addBtn).toBeVisible();
        await expect(addBtn).toBeEnabled();
    });
});
