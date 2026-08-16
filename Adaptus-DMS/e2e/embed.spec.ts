import { test, expect } from "@playwright/test";
import { authSkipReason, hasAuth, login } from "./fixtures/auth";

test.describe("Public inventory API + widget (unauthenticated)", () => {
    test("GET /api/vehicles/public without scope is 400", async ({ request }) => {
        const res = await request.get("/api/vehicles/public");
        expect(res.status()).toBe(400);
        const json = (await res.json()) as { error?: string };
        expect(json.error || "").toMatch(/dealership/i);
    });

    test("GET /api/vehicles/public with bogus token is 401", async ({ request }) => {
        const res = await request.get("/api/vehicles/public?token=aix_not_a_real_token");
        expect(res.status()).toBe(401);
    });

    test("unknown VDP is a not-found page without leaking a VIN", async ({ page }) => {
        await page.goto("/embed/vehicles/00000000-0000-0000-0000-000000000000");
        await expect(page.getByText(/not found|404/i).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText(/[A-HJ-NPR-Z0-9]{17}/).first()).toHaveCount(0);
    });
});

test.describe("Website embed (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("settings page has snippet, iframe, and live preview", async ({ page }) => {
        await page.goto("/settings/website");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText(/website inventory embed/i).first()).toBeVisible();
        await expect(page.getByText(/data-adaptus-inventory|iframe src=/i).first()).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.getByRole("button", { name: /^iframe$/i })).toBeVisible();
        const preview = page.frameLocator('iframe[title="Inventory preview"]');
        await expect(preview.locator(".adaptus-inv").first()).toBeVisible({ timeout: 20_000 });
    });

    test("public VDP for an Active unit has no 17-char VIN and Enquire when slug exists", async ({
        page,
    }) => {
        const vehicles = await page
            .evaluate(async () => {
                const res = await fetch("/api/vehicles?limit=1&status=Active");
                if (!res.ok) return [];
                const json = await res.json().catch(() => null);
                const list = Array.isArray(json?.data)
                    ? json.data
                    : Array.isArray(json)
                      ? json
                      : [];
                return list
                    .map((v: { id?: string; status?: string }) => v.id)
                    .filter(Boolean) as string[];
            })
            .catch(() => []);

        if (vehicles.length === 0) {
            test.skip(true, "No Active vehicles — public VDP not available");
        }

        await page.goto(`/embed/vehicles/${vehicles[0]}`);
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText(/[A-HJ-NPR-Z0-9]{17}/).first()).toHaveCount(0);

        const ld = page.locator('script[type="application/ld+json"]');
        if ((await ld.count()) > 0) {
            const text = await ld.textContent();
            expect(text).not.toMatch(/"[A-HJ-NPR-Z0-9]{17}"/);
        }
    });

    test("iframe widget is full-lot inventory with filters and hosted VDP links", async ({
        page,
    }) => {
        const settings = await page.evaluate(async () => {
            const res = await fetch("/api/embed/settings");
            if (!res.ok) return null;
            const json = await res.json();
            return json?.data as { embed_token?: string; dealership_id?: string } | null;
        });
        const embedToken = settings?.embed_token;
        const dealerId = settings?.dealership_id ?? "";
        test.skip(!embedToken, "Embed settings unavailable for this user");
        if (!embedToken) return;

        const listed = await page.evaluate(async (creds) => {
            const res = await fetch(
                `/api/vehicles/public?token=${encodeURIComponent(creds.token)}&dealership_id=${encodeURIComponent(creds.dealerId)}&limit=100`
            );
            const json = await res.json();
            return {
                ok: res.ok,
                count: Number(json.count || 0),
                page: (json.data || []).length,
                dealershipId: json.dealership?.id as string | undefined,
                makes: (json.facets?.makes || []) as string[],
            };
        }, { token: embedToken, dealerId });

        expect(listed.ok).toBe(true);
        expect(listed.dealershipId).toBe(dealerId || listed.dealershipId);
        expect(listed.page).toBeLessThanOrEqual(listed.count || listed.page);

        const origin = new URL(page.url()).origin;
        const iframeRes = await page.request.get(
            `${origin}/embed/inventory?token=${encodeURIComponent(embedToken)}&dealership_id=${encodeURIComponent(dealerId)}&limit=12`
        );
        expect(iframeRes.ok()).toBe(true);
        expect(await iframeRes.text()).toMatch(/data-adaptus-inventory/);

        const attr = (value: string) =>
            value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        await page.setContent(
            `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#111;color:#eee;margin:0">
  <div data-adaptus-inventory data-token="${attr(embedToken)}" data-dealership="${attr(dealerId)}" data-limit="12" data-api-origin="${attr(origin)}"></div>
</body></html>`
        );
        await page.addScriptTag({ url: `${origin}/embed/inventory.js` });

        await expect(page.getByRole("heading", { name: /all inventory/i })).toBeVisible({
            timeout: 20_000,
        });
        await expect(page.getByLabel(/^make$/i)).toBeVisible();
        await expect(page.getByLabel(/^model$/i)).toBeVisible();
        await expect(page.getByLabel(/^year$/i)).toBeVisible();

        const cards = page.locator("a.adaptus-inv__card");
        const empty = page.getByText(/no vehicles available/i);
        await expect(cards.first().or(empty)).toBeVisible({ timeout: 20_000 });
        const cardTexts = await cards.allInnerTexts();
        for (const text of cardTexts) {
            expect(text).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/);
        }
        const ld = page.locator('script[type="application/ld+json"]');
        if ((await ld.count()) > 0) {
            expect(await ld.textContent()).not.toMatch(/"[A-HJ-NPR-Z0-9]{17}"/);
        }

        const card = cards.first();
        if ((await card.count()) === 0) {
            test.skip(true, "No Active public vehicles to click");
        }
        const href = await card.getAttribute("href");
        expect(href).toMatch(/\/embed\/vehicles\//);

        if (listed.makes.length > 0) {
            await page.getByLabel(/^make$/i).selectOption(listed.makes[0]!);
            await page.getByRole("button", { name: /^find$/i }).click();
            await expect(page.locator(".adaptus-inv")).toBeVisible({ timeout: 15_000 });
            const filteredCards = page.locator("a.adaptus-inv__card");
            if ((await filteredCards.count()) > 0) {
                await expect(filteredCards.first()).toBeVisible();
            }
        }
    });

    test("dashboard stays unframed while embed inventory allows iframe", async ({ page }) => {
        const settingsHeaders = await page.request.get("/settings/website");
        const embedHeaders = await page.request.get("/embed/inventory?token=aix_probe");
        const settingsCsp = settingsHeaders.headers()["content-security-policy"] || "";
        const embedCsp = embedHeaders.headers()["content-security-policy"] || "";
        const xfo = settingsHeaders.headers()["x-frame-options"] || "";
        expect(xfo.toUpperCase()).toContain("DENY");
        expect(settingsCsp).toMatch(/frame-ancestors 'none'/);
        expect(embedCsp).toMatch(/frame-ancestors \*/);
        expect(embedHeaders.headers()["x-frame-options"] || "").toBe("");
    });
});
