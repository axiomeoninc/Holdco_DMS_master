import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    e2eEmail,
    hasAuth,
    login,
    volatileMask,
} from "./fixtures/auth";

test.describe("Auth journeys", () => {
    test("login form renders", async ({ page }, testInfo) => {
        await page.goto("/login");
        await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.locator("#password-input")).toBeVisible();

        // Critical route screenshot (desktop only) — attach, not OS-locked baseline
        if (testInfo.project.name === "desktop") {
            const shot = await page.screenshot({
                fullPage: true,
                mask: volatileMask(page),
                animations: "disabled",
            });
            await testInfo.attach("login", { body: shot, contentType: "image/png" });
        }
    });

    test("forgot password honesty", async ({ page }) => {
        await page.goto("/forgot-password");
        await expect(
            page.getByRole("heading", { name: /forgot password/i })
        ).toBeVisible();
        await expect(
            page.getByText(/reset link if that address is registered/i)
        ).toBeVisible();

        await page.getByLabel(/email/i).fill("e2e-honesty-check@example.com");
        await page.getByRole("button", { name: /send reset link/i }).click();

        // Honest success copy (enumeration-safe) and/or Resend-not-configured warning
        const honest = page.getByText(
            /if that email is registered|not configured|add via wrangler/i
        );
        await expect(honest.first()).toBeVisible({ timeout: 15_000 });
    });

    test("login + logout", async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
        await expect(page).not.toHaveURL(/\/login/);

        // Prefer sidebar Sign out (desktop); fall back to account menu
        const sidebarSignOut = page.getByRole("button", { name: /^sign out$/i });
        if ((await sidebarSignOut.count()) > 0) {
            await sidebarSignOut.first().click();
        } else {
            await page.getByRole("button", { name: /account menu/i }).click();
            await page.getByRole("button", { name: /^sign out$/i }).click();
        }

        await page.waitForURL(/\/login/, { timeout: 20_000 });
        await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    });

    test("login with credentials lands off /login", async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
        await expect(page).not.toHaveURL(/\/login/);
        // Sanity: shell or dashboard content present
        await expect(
            page
                .locator("h1")
                .first()
                .or(page.getByRole("navigation", { name: /main/i }))
                .first()
        ).toBeVisible({ timeout: 20_000 });
        void e2eEmail;
    });
});
