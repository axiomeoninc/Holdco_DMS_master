import { test, expect } from "@playwright/test";
import { authSkipReason, hasAuth, login } from "./fixtures/auth";

test.describe("Money PDF entry points", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("invoices list exposes Download PDF", async ({ page }) => {
        await page.goto("/invoices");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/invoice/i);

        const row = page.locator("table tbody tr").first();
        if ((await row.count()) === 0) {
            test.skip(true, "No invoice rows — PDF entry point not available");
        }

        const more = row.getByRole("button", { name: /more actions/i });
        await expect(more).toBeVisible({ timeout: 10_000 });
        await more.click();
        await expect(
            page.getByRole("menuitem", { name: /download pdf/i })
        ).toBeVisible();
    });

    test("quotations list exposes Download PDF", async ({ page }) => {
        await page.goto("/quotations");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/quotation/i);

        const pdfBtn = page.locator("button[title='Download PDF']").first();
        if ((await pdfBtn.count()) === 0) {
            test.skip(true, "No quotation PDF buttons — list may be empty");
        }
        await expect(pdfBtn).toBeVisible();
        await expect(pdfBtn).toBeEnabled();
    });
});
