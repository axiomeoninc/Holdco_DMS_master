import { test, expect } from "@playwright/test";
import { authSkipReason, hasAuth, login } from "./fixtures/auth";

// Email integration on the quotations list: the real "Email to customer
// (Resend)" action and the separate "Mark as Sent (status only — no email)"
// action. CI may or may not have Resend configured, so assertions verify the
// flow reached the correct endpoint and the honest outcome, rather than
// hardcoding a 503/200.
test.describe("Email integration (quotations)", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("quotations list exposes both Email (Resend) and Mark as Sent actions", async ({
        page,
    }) => {
        await page.goto("/quotations");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("h1").first()).toContainText(/quotation/i);

        const rows = page.locator("table tbody tr");
        if ((await rows.count()) === 0) {
            test.skip(true, "No quotation rows — email actions not available");
        }

        // A Draft row carries both actions. Find one to assert they coexist.
        const draftRow = rows
            .filter({ has: page.locator("button[title*='Mark as Sent']") })
            .first();
        if ((await draftRow.count()) === 0) {
            test.skip(
                true,
                "No Draft quotations — Mark as Sent action not available"
            );
        }

        await expect(
            draftRow.locator(
                "button[title='Email quote to customer (Resend)']"
            )
        ).toBeVisible();
        await expect(
            draftRow.locator("button[title*='Mark as Sent']")
        ).toBeVisible();

        // The two actions are distinct controls, not the same button.
        await expect(
            draftRow.locator("button[title='Email quote to customer (Resend)']")
        ).not.toHaveAttribute("title", /mark as sent/i);
    });

    test("email action hits the send endpoint and reports the honest outcome", async ({
        page,
    }) => {
        await page.goto("/quotations");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const emailBtn = page
            .locator("button[title='Email quote to customer (Resend)']")
            .first();
        if ((await emailBtn.count()) === 0) {
            test.skip(true, "No email action available");
        }

        const sendPromise = page.waitForResponse(
            (res) =>
                res.request().method() === "POST" &&
                res.url().includes("/api/quotations/") &&
                res.url().endsWith("/send"),
            { timeout: 15_000 }
        );

        await emailBtn.click();

        const response = await sendPromise;
        const body = (await response.json().catch(() => ({}))) as {
            success?: boolean;
            error?: string;
            missingConfig?: boolean;
        };

        if (response.status() === 503) {
            // Resend unconfigured → the honest 503 path (no fake send).
            expect(body.missingConfig).toBe(true);
            expect(body.error).toMatch(/resend.*not configured/i);
        } else {
            // Resend configured → real 2xx with a success flag.
            expect(response.status()).toBeGreaterThanOrEqual(200);
            expect(response.status()).toBeLessThan(300);
            expect(body.success).toBe(true);
        }
    });

    test("Mark as Sent updates status without emailing", async ({ page }) => {
        await page.goto("/quotations");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });

        const markSentBtn = page
            .locator("button[title*='Mark as Sent']")
            .first();
        if ((await markSentBtn.count()) === 0) {
            test.skip(true, "No Mark as Sent action available");
        }

        // No POST may reach the email send endpoint.
        let sendHits = 0;
        page.on("request", (req) => {
            if (
                req.method() === "POST" &&
                req.url().includes("/api/quotations/") &&
                req.url().endsWith("/send")
            ) {
                sendHits += 1;
            }
        });

        const patchPromise = page.waitForResponse(
            (res) =>
                res.request().method() === "PATCH" &&
                res.url().includes("/api/quotations/"),
            { timeout: 15_000 }
        );

        await markSentBtn.click();

        const patchRes = await patchPromise;
        expect(patchRes.ok()).toBeTruthy();

        // Give any stray POST a moment, then assert none hit the email endpoint.
        await page.waitForTimeout(500);
        expect(sendHits).toBe(0);

        // Honest toast confirms status-only, no email.
        await expect(page.getByText(/marked as sent.*no email/i)).toBeVisible();
    });
});
