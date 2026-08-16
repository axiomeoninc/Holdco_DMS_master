import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

test.describe("Credit applications", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("credit list loads", async ({ page }) => {
        await page.goto("/finance/credit");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/credit/i);
    });

    test("capture page renders with honest amber partner gating", async ({
        page,
    }) => {
        await page.goto("/finance/credit/new");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/new credit application/i);

        // OCR prefill surface.
        await expect(page.getByText(/OCR prefill/i).first()).toBeVisible();

        // Honest gating: FlashFender is not a lender — applications stay local
        // until a partner channel is configured.
        await expect(
            page.getByText(/flashfender is not a lender/i).first()
        ).toBeVisible();

        // Submit is present but gated by the amber honesty copy.
        const saveBtn = page.getByRole("button", { name: /save application/i });
        await expect(saveBtn).toBeVisible();
    });

    test("prefill hint when opened without a customer", async ({ page }) => {
        await page.goto("/finance/credit/new");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText(/prefill CRM data|customer_id=&lead_id=/i).first()
        ).toBeVisible();
    });
});
