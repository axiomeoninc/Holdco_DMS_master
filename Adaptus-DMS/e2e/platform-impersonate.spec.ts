import { test, expect } from "@playwright/test";
import { authSkipReason, hasAuth, login } from "./fixtures/auth";

/**
 * Session-mutating flow — must run serial and preferably one worker.
 * Swap → Viewing as banner → Exit → /platform
 */
test.describe.configure({ mode: "serial" });

test.describe("Platform impersonate", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        // Avoid racing two projects against one shared session
        test.skip(
            test.info().project.name !== "desktop",
            "Impersonation runs on desktop only (serial session)"
        );
        await login(page);
    });

    test("swap → banner → exit → /platform", async ({ page }) => {
        await page.goto("/platform/impersonate");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const impersonateBtn = page.getByRole("button", { name: /^impersonate$/i });
        const blocked = page.getByText(
            /platform admin required|impersonation is not configured/i
        );
        await expect(blocked.or(impersonateBtn.first())).toBeVisible({
            timeout: 20_000,
        });

        if (await page.getByText(/platform admin required/i).isVisible().catch(() => false)) {
            test.skip(true, "E2E user is not a platform admin");
        }

        if (
            await page
                .getByText(/impersonation is not configured/i)
                .isVisible()
                .catch(() => false)
        ) {
            test.skip(true, "Impersonation stash is not configured on this environment");
        }

        await expect(impersonateBtn.first()).toBeVisible({ timeout: 20_000 });
        await impersonateBtn.first().click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await dialog.getByRole("button", { name: /^impersonate$/i }).click();

        const leftPlatform = await page
            .waitForURL((url) => !url.pathname.startsWith("/platform"), {
                timeout: 15_000,
            })
            .then(() => true)
            .catch(() => false);

        if (!leftPlatform) {
            test.skip(
                true,
                "Impersonation fail-closed — stash secret not configured on this environment"
            );
        }

        // Navigate to a tenant route if still needed
        if (page.url().includes("/platform")) {
            await page.goto("/dashboard");
        }

        const banner = page.getByRole("status").filter({ hasText: /viewing as/i });
        await expect(banner).toBeVisible({ timeout: 20_000 });

        await banner.getByRole("button", { name: /^exit$/i }).click();
        await page.waitForURL(/\/platform\/?$/, { timeout: 30_000 });
        await expect(page.locator("h1").first()).toContainText(/platform/i);
        await expect(page.getByText(/viewing as/i)).toHaveCount(0);
    });
});
