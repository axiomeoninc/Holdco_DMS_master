import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

test.describe("Service", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("service history tab loads", async ({ page }) => {
        await page.goto("/service");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/service/i);

        await expect(page.getByText(/service history/i).first()).toBeVisible();
        await expect(page.getByText(/add service/i).first()).toBeVisible();
    });

    test("reactivation candidates tab is amber informational", async ({ page }) => {
        await page.goto("/service");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        await page.getByRole("tab", { name: /reactivation candidates/i }).click();
        await expect(page.locator("h1").first()).toContainText(/service/i);

        // Honest informational banner — reactivation never auto-sends.
        await expect(
            page.getByText(/no messages are sent automatically/i).first()
        ).toBeVisible({ timeout: 10_000 });
    });
});
