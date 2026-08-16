import { test, expect } from "@playwright/test";
import { authSkipReason, hasAuth, login } from "./fixtures/auth";

test.describe("Desk help chrome", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("command palette opens actions and glossary", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        await page.keyboard.press("Control+K");
        const dialog = page.getByRole("dialog", { name: /command palette/i });
        await expect(dialog).toBeVisible({ timeout: 8_000 });
        await expect(dialog.getByText(/ask flash ai/i)).toBeVisible();
        await expect(dialog.getByText(/new vehicle/i)).toBeVisible();
        await expect(dialog.getByText(/what’s a quotation/i)).toBeVisible();

        await dialog.getByText(/what’s a quotation/i).click();
        const help = page.getByRole("dialog", { name: /what’s a quotation/i });
        await expect(help).toBeVisible({ timeout: 8_000 });
        await expect(help.getByText(/priced offer/i)).toBeVisible();
        await expect(help.getByRole("button", { name: /ask flash ai/i })).toBeVisible();
        await help.getByRole("button", { name: /got it/i }).click();
        await expect(help).toHaveCount(0);
    });
});
