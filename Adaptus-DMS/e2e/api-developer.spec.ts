import { test, expect, type Page } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

/**
 * Developer tools: API tokens, webhooks, full data export, accounting
 * export, audit trail, retention. Data-creating actions are entry-point-only
 * or cleaned up — we never leave a token/webhook behind on live data.
 */
test.describe("API / developer tools", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    async function openDeveloperPanel(page: Page) {
        await page.goto("/settings/integrations");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText(/developer tools/i).first()).toBeVisible({
            timeout: 10_000,
        });
    }

    test("API token create surface + one-time display", async ({ page }) => {
        await openDeveloperPanel(page);

        const createBtn = page.getByRole("button", { name: /create token/i });
        await expect(createBtn).toBeVisible({ timeout: 10_000 });

        // Entry-point only: we do not create a token on live data.
        // Assert the one-time display text is present in the UI copy.
        await expect(
            page.getByText(/token shown once|shown once|one-time/i).first()
        ).toBeVisible();
    });

    test("webhook CRUD surface renders", async ({ page }) => {
        await openDeveloperPanel(page);

        const section = page.getByText(/^Webhooks$/i).first();
        await expect(section).toBeVisible({ timeout: 10_000 });

        const urlInput = page.getByPlaceholder(/your-app\.example\.com\/webhook/i);
        await expect(urlInput).toBeVisible();
        const addBtn = page.getByRole("button", { name: /add webhook/i });
        await expect(addBtn).toBeVisible();
    });

    test("full data export entry points", async ({ page }) => {
        await openDeveloperPanel(page);

        await expect(
            page.getByRole("button", { name: /download json/i })
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: /download excel/i })
        ).toBeVisible();
    });

    test("accounting export: format picker + download journal", async ({ page }) => {
        await page.goto("/settings/accounting");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/accounting export/i);

        // Format options (QuickBooks IIF / Xero / Sage).
        await expect(page.getByText(/quickbooks \(iif\)/i).first()).toBeVisible();
        await expect(page.getByText(/xero \(journal csv\)/i).first()).toBeVisible();
        await expect(page.getByText(/sage 50 \(csv\)/i).first()).toBeVisible();

        const downloadBtn = page.getByRole("button", { name: /download journal/i });
        await expect(downloadBtn).toBeVisible();
        await expect(downloadBtn).toBeEnabled();
    });

    test("audit trail lists entries (or honest empty state)", async ({ page }) => {
        await page.goto("/settings/audit");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/audit trail/i);

        const rows = page.locator("ul li").first();
        if ((await rows.count()) > 0 && (await rows.isVisible().catch(() => false))) {
            await expect(rows).toBeVisible({ timeout: 10_000 });
        } else {
            // Immutable, read-only page — either honest empty state or the
            // always-present immutable banner.
            await expect(
                page.getByText(/no audit events found|read-only and immutable/i).first()
            ).toBeVisible();
        }
    });

    test("retention export + compliance pack entry points", async ({ page }) => {
        await page.goto("/settings/retention");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/retention/i);

        const exportBtn = page.getByRole("button", {
            name: /download full retention export/i,
        });
        await expect(exportBtn).toBeVisible();

        const packBtn = page.getByRole("button", {
            name: /generate compliance pack/i,
        });
        if ((await packBtn.count()) > 0) {
            await expect(packBtn).toBeVisible();
        }
    });
});
