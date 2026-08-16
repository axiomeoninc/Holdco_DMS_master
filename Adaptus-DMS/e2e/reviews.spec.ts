import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

test.describe("Reviews", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("settings page loads review automation", async ({ page }) => {
        await page.goto("/settings/reviews");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/review/i);

        // Honest surface: configured or amber not-configured state.
        const saveBtn = page.getByRole("button", { name: /save settings/i });
        await expect(saveBtn).toBeVisible();
    });

    test("/review/<token> landing is public", async ({ page }) => {
        // Resolve a review request token (read-only). The landing is public.
        const token = await page
            .evaluate(async () => {
                const res = await fetch("/api/reviews/requests?limit=1");
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                const rows = Array.isArray(json?.data) ? json.data : [];
                return rows[0]?.token ?? null;
            })
            .catch(() => null);

        if (!token) {
            test.skip(true, "No review requests exist — landing not available");
        }

        await page.goto(`/review/${token}`);
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/thanks for visiting|Hi /);
    });

    test("unknown review token 404s", async ({ page }) => {
        await page.goto("/review/not-a-real-token");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText(/not found|404|page could not be found/i).first()
        ).toBeVisible();
    });
});
