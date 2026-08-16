import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
    volatileMask,
} from "./fixtures/auth";

test.describe("Platform hub", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("/platform hub loads tools", async ({ page }, testInfo) => {
        await page.goto("/platform");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/platform/i);

        const forbidden = page.getByText(/platform admin required/i);
        if (await forbidden.isVisible().catch(() => false)) {
            test.skip(true, "E2E user is not a platform admin");
        }

        await expect(page.getByRole("heading", { name: /platform tools/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /impersonate/i }).first()).toBeVisible();
        await expect(page.getByRole("link", { name: /analytics/i }).first()).toBeVisible();

        if (testInfo.project.name === "desktop") {
            const shot = await page.screenshot({
                fullPage: true,
                mask: volatileMask(page),
                animations: "disabled",
            });
            await testInfo.attach("platform-hub", {
                body: shot,
                contentType: "image/png",
            });
        }
    });
});
