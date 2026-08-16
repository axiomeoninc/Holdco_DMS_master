import { test, expect } from "@playwright/test";
import { authSkipReason, axeScan, hasAuth, login } from "./fixtures/auth";

/**
 * Evolved from ui-spacing.spec.ts — axe on key routes only.
 * Critical screenshots live in auth / platform-hub / crm-smoke (3 routes).
 */
const A11Y_ROUTES = [
    { path: "/login", name: "login", auth: false },
    { path: "/forgot-password", name: "forgot-password", auth: false },
    { path: "/dashboard", name: "dashboard", auth: true },
    { path: "/leads", name: "leads", auth: true },
    { path: "/customers", name: "customers", auth: true },
    { path: "/deals", name: "deals", auth: true },
    { path: "/inventory", name: "inventory", auth: true },
    { path: "/invoices", name: "invoices", auth: true },
    { path: "/quotations", name: "quotations", auth: true },
    { path: "/service", name: "service", auth: true },
    { path: "/finance", name: "finance", auth: true },
    { path: "/finance/credit", name: "finance-credit", auth: true },
    { path: "/settings/integrations", name: "settings-integrations", auth: true },
    { path: "/settings/accounting", name: "settings-accounting", auth: true },
    { path: "/settings/audit", name: "settings-audit", auth: true },
    { path: "/settings/retention", name: "settings-retention", auth: true },
    { path: "/settings/ai-governance", name: "settings-ai-governance", auth: true },
    { path: "/settings/reviews", name: "settings-reviews", auth: true },
    { path: "/settings/locations", name: "settings-locations", auth: true },
    { path: "/platform", name: "platform", auth: true },
] as const;

test.describe("Route a11y (axe)", () => {
    for (const route of A11Y_ROUTES) {
        test(`${route.name} — no serious/critical axe`, async ({ page }) => {
            if (route.auth) {
                test.skip(!hasAuth, authSkipReason);
                await login(page);
            }

            await page.goto(route.path);
            if (route.path === "/login") {
                await expect(
                    page.getByRole("heading", { name: /sign in/i })
                ).toBeVisible({ timeout: 20_000 });
            } else if (route.path === "/forgot-password") {
                await expect(
                    page.getByRole("heading", { name: /forgot password/i })
                ).toBeVisible({ timeout: 20_000 });
            } else {
                await expect(page.locator("h1").first()).toBeVisible({
                    timeout: 20_000,
                });
            }

            await axeScan(page, route.name);
        });
    }
});
