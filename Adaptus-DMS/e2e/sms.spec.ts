import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

/**
 * SMS surface. The settings panel is entry-point only (quiet-hours toggle is
 * a real mutation, so we assert the switch renders, not that we flip it). The
 * opt-out consent API is exercised with an invalid customer id — the honest
 * 400 validation path — never with live customer data.
 */
test.describe("SMS", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("integrations page shows SMS status + quiet hours", async ({ page }) => {
        await page.goto("/settings/integrations");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });

        const section = page.getByText(/^SMS \/ Texting$/i).first();
        await expect(section).toBeVisible({ timeout: 10_000 });

        // Honest amber/configured state, or the quiet-hours switch.
        const quietSwitch = page.getByRole("switch", { name: /quiet hours/i });
        if ((await quietSwitch.count()) > 0) {
            await expect(quietSwitch).toBeVisible();
            await expect(quietSwitch).toBeEnabled();
        } else {
            await expect(
                page.getByText(/SMS not configured|Twilio configured/i).first()
            ).toBeVisible();
        }
    });

    test("sms sequences dashboard loads", async ({ page }) => {
        await page.goto("/sms-sequences");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toHaveText(/SMS sequences/i);
        await expect(page.getByText(/Templates/i).first()).toBeVisible();
    });

    test("opt-out consent API validates input honestly", async ({ page }) => {
        // No mutation: missing/invalid customer_id must 400, never silently pass.
        const res = await page.request.post("/api/sms/opt-in", {
            data: {},
        });
        expect(res.status()).toBe(400);
        const body = await res.json().catch(() => ({}));
        expect(body?.error).toBeTruthy();
    });
});
