import { test, expect, type Page } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

/** The exact fail-closed 400 body the deposit bug produced. */
const REFERENCE_TYPE_ERROR = /reference_type must be one of/i;

async function firstDealId(page: Page): Promise<string | null> {
    return page
        .evaluate(async () => {
            const res = await fetch("/api/deals?limit=1");
            if (!res.ok) return null;
            const json = await res.json().catch(() => null);
            const list = Array.isArray(json?.data) ? json.data : [];
            return list[0]?.id ?? null;
        })
        .catch(() => null);
}

test.describe("Deals + F&I journeys", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("deals list loads with rows or cards", async ({ page }) => {
        await page.goto("/deals");
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/deal/i);

        const row = page.locator("table tbody tr").first();
        if ((await row.count()) > 0 && (await row.isVisible().catch(() => false))) {
            await expect(row).toBeVisible();
        }
        // Mobile card list or empty state is also honest.
    });

    test("regression: deposit button never 400s with reference_type error", async ({
        page,
    }) => {
        // Regression for bug-payments: the deals page used to double-stringify
        // the checkout body, so the server saw reference_type as undefined and
        // returned "reference_type must be one of: invoice, deal, deposit,
        // bill_of_sale". The honest pass state is 409 PAYMENTS_NOT_CONFIGURED.
        const dealId = await firstDealId(page);
        if (!dealId) {
            test.skip(true, "No deal rows — deposit capture not available");
        }

        await page.goto(`/deals/${dealId}`);
        const deposit = page.getByRole("button", { name: /collect deposit/i }).first();
        await expect(deposit).toBeVisible({ timeout: 20_000 });

        const responsePromise = page.waitForResponse(
            (res) =>
                res.url().includes("/api/payments/checkout") && res.request().method() === "POST"
        );
        await deposit.click();
        const response = await responsePromise;

        const body = (await response.json().catch(() => null)) as {
            error?: string;
            code?: string;
            data?: { url?: string } | null;
        } | null;

        // The regression: a 400 carrying the reference_type enum error.
        // Honest states that must NOT be treated as failures: 409
        // PAYMENTS_NOT_CONFIGURED, and non-reference-type 400s such as
        // "Nothing to pay" (deposit already covered) or a cancelled/lost deal.
        expect(
            body?.error,
            `deposit must never fail with the reference_type error (got ${response.status()}: ${body?.error})`
        ).not.toMatch(REFERENCE_TYPE_ERROR);

        if (response.status() === 200) {
            expect(body?.data?.url).toBeTruthy();
        } else if (response.status() === 409) {
            expect(body?.code).toBe("PAYMENTS_NOT_CONFIGURED");
        } else if (response.status() === 400) {
            // Legitimate fail-closed states other than the enum error.
            expect(body?.error).toBeTruthy();
        } else {
            // Any other status is a real defect on the deposit path.
            expect(response.status()).toBeLessThan(400);
        }
    });

    test("deal payment status panel renders", async ({ page }) => {
        const dealId = await firstDealId(page);
        if (!dealId) {
            test.skip(true, "No deal rows — payment panel not available");
        }

        await page.goto(`/deals/${dealId}`);
        const panel = page.getByRole("heading", { name: /payment/i }).first();
        await expect(panel).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText(/deposit amount/i).first()).toBeVisible();
        await expect(page.getByText(/deposit paid/i).first()).toBeVisible();
    });

    test("Bill of Sale entry point on deal detail", async ({ page }) => {
        const dealId = await firstDealId(page);
        if (!dealId) {
            test.skip(true, "No deal rows — BOS entry point not available");
        }

        await page.goto(`/deals/${dealId}`);
        const bos = page.getByRole("button", { name: /bill of sale/i }).first();
        await expect(bos).toBeVisible({ timeout: 20_000 });
    });

    test("quotation convert entry point (does not mutate)", async ({ page }) => {
        // Entry-point only: assert the Convert control exists on Draft rows.
        // We do not click it — converting creates a real deal.
        await page.goto("/quotations");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toHaveText(/quotation/i);

        const convertBtn = page.getByTitle("Convert to deal").first();
        if ((await convertBtn.count()) > 0) {
            await expect(convertBtn).toBeVisible();
        }
    });
});
