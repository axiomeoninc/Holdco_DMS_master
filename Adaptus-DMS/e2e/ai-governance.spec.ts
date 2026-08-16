import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

test.describe("AI governance console", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("governance page loads with guardrails + correction log", async ({
        page,
    }) => {
        await page.goto("/settings/ai-governance");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/ai governance/i);

        await expect(page.getByText(/claims guardrails/i).first()).toBeVisible({
            timeout: 10_000,
        });
        await expect(page.getByText(/correction log/i).first()).toBeVisible({
            timeout: 10_000,
        });
    });

    test("quiet hours + after-hours controls render", async ({ page }) => {
        await page.goto("/settings/ai-governance");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const section = page.getByText(/quiet hours/i).first();
        await expect(section).toBeVisible({ timeout: 10_000 });

        const afterHours = page.getByText(/after-hours AI activity/i).first();
        await expect(afterHours).toBeVisible({ timeout: 10_000 });
    });
});
