import { test, expect, type Page } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

/** Open the first lead's detail drawer on either viewport. */
async function openFirstLead(page: Page): Promise<boolean> {
    // Desktop table — real lead rows carry role="button" (the loading skeleton
    // row does not), so wait for an actual data row instead of clicking the
    // skeleton, which has no handler and would never open the drawer.
    if (await page.locator("table").first().isVisible().catch(() => false)) {
        const row = page.locator("table tbody tr[role='button']").first();
        try {
            await row.waitFor({ state: "visible", timeout: 12_000 });
            await row.click();
            return true;
        } catch {
            // No lead rows on desktop — fall through to mobile cards.
        }
    }
    // Mobile: cards list with a View action button.
    const viewBtn = page.locator("div.lg\\:hidden button[aria-label^='View ']").first();
    try {
        await viewBtn.waitFor({ state: "visible", timeout: 5_000 });
        await viewBtn.click();
        return true;
    } catch {
        return false;
    }
}

test.describe("CRM / leads journeys", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("leads list loads", async ({ page }) => {
        await page.goto("/leads");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/lead/i);
    });

    test("lead detail opens with AI explainer + after-hours panels", async ({
        page,
    }) => {
        await page.goto("/leads");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const opened = await openFirstLead(page);
        if (!opened) {
            test.skip(true, "No lead rows — detail panels not available");
        }

        const whyPanel = page.getByText(/why this lead/i).first();
        await expect(whyPanel).toBeVisible({ timeout: 15_000 });

        const afterHours = page
            .getByText(/after-hours AI first response/i)
            .first();
        await expect(afterHours).toBeVisible({ timeout: 10_000 });
    });

    test("lead call log entry point", async ({ page }) => {
        await page.goto("/leads");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const opened = await openFirstLead(page);
        if (!opened) {
            test.skip(true, "No lead rows — call log not available");
        }

        const logCall = page.getByRole("button", { name: /log call/i }).first();
        await expect(logCall).toBeVisible({ timeout: 15_000 });
    });

    test("lead email sequence enroll entry point", async ({ page }) => {
        await page.goto("/leads");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const opened = await openFirstLead(page);
        if (!opened) {
            test.skip(true, "No lead rows — email sequence not available");
        }

        // Entry-point only: assert the sequence surface renders without
        // actually enrolling (enroll sends a real first email when configured).
        const sequenceTitle = page
            .getByText(/email sequence/i)
            .first();
        await expect(sequenceTitle).toBeVisible({ timeout: 15_000 });
    });

    test("customers list loads", async ({ page }) => {
        await page.goto("/customers");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/customer/i);
    });
});
