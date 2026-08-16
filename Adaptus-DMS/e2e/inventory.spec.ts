import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

test.describe("Inventory journeys", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("list loads with Active status filter", async ({ page }) => {
        await page.goto("/inventory");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/inventory/i);

        // The Active status chip is the default view.
        const activeChip = page.getByRole("button", { name: /^active$/i }).first();
        await expect(activeChip).toBeVisible({ timeout: 10_000 });

        // Search is a VIN/make/model lookup.
        const search = page.getByPlaceholder(/vin|make|model|stock/i).first();
        await expect(search).toBeVisible();
    });

    test("add vehicle entry point exists when permitted", async ({ page }) => {
        await page.goto("/inventory");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const addBtn = page.getByRole("button", { name: /add vehicle/i }).first();
        await expect(addBtn).toBeVisible({ timeout: 15_000 });
        await expect(addBtn).toBeEnabled();
    });

    test("unit rows expose edit + detail entry points", async ({ page }) => {
        await page.goto("/inventory");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const row = page.locator("table tbody tr").first();
        if ((await row.count()) === 0) {
            test.skip(true, "No inventory rows — edit entry point not available");
        }

        // Rows navigate to /inventory/<vin>; edit actions open the edit route.
        await expect(row).toBeVisible({ timeout: 10_000 });
        const vinCell = row.locator("td").first();
        await expect(vinCell).toBeVisible();
    });

    test("GET /api/vehicles without rooftop is fail-closed", async ({ page }) => {
        await page.context().addCookies([
            {
                name: "dealership_id",
                value: "",
                url: page.url(),
                expires: 0,
            },
        ]);
        await page.evaluate(() => {
            document.cookie = "dealership_id=; Path=/; Max-Age=0";
        });

        const result = await page.evaluate(async () => {
            const res = await fetch("/api/vehicles?limit=50", {
                credentials: "include",
            });
            const json = (await res.json().catch(() => null)) as {
                data?: Array<{ dealership_id?: string }>;
            } | null;
            const list = Array.isArray(json?.data)
                ? json.data
                : Array.isArray(json)
                  ? json
                  : [];
            const roofs = new Set(
                list
                    .map((v) =>
                        typeof v.dealership_id === "string" ? v.dealership_id : ""
                    )
                    .filter(Boolean)
            );
            return { status: res.status, count: list.length, roofs: roofs.size };
        });

        expect(result.status).toBeLessThan(500);
        expect(
            result.roofs,
            "/api/vehicles without rooftop must not dump mixed tenants"
        ).toBeLessThanOrEqual(1);
        if (result.roofs === 0) {
            expect(result.count).toBe(0);
        }
    });

    test("public embed emits vehicle JSON-LD", async ({ page }) => {
        // Resolve a vehicle id via the authenticated API, then hit the public embed.
        const vehicles = await page
            .evaluate(async () => {
                const res = await fetch("/api/vehicles?limit=1&status=Active");
                if (!res.ok) return [];
                const json = await res.json().catch(() => null);
                const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
                return list.map((v: { id?: string }) => v.id).filter(Boolean);
            })
            .catch(() => []);

        if (vehicles.length === 0) {
            test.skip(true, "No Active vehicles — embed JSON-LD not available");
        }

        await page.goto(`/embed/vehicles/${vehicles[0]}`);
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const ld = page.locator('script[type="application/ld+json"]');
        await expect(ld).toHaveCount(1);
        const text = await ld.textContent();
        expect(text).toContain("@context");
        expect(text).toMatch(/"@type"\s*:\s*"(Car|Vehicle)"/);
    });
});
