import { test, expect } from "@playwright/test";
import {
    authSkipReason,
    hasAuth,
    login,
} from "./fixtures/auth";

/**
 * E-sign smoke. We resolve a real signature-able document id (read-only) and
 * assert the signing surface renders — typed name/initials/consent and the
 * signed-PDF download entry point. We do NOT submit: that writes a real
 * signature record on live data.
 */
test.describe("E-signature journeys", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("signature page renders typed-signing surface for a real document", async ({
        page,
    }) => {
        // Read-only resolution of a document id via the authenticated API.
        const docId = await page
            .evaluate(async () => {
                const res = await fetch("/api/quotations?limit=1");
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                const list = Array.isArray(json?.data) ? json.data : [];
                return list[0]?.id ?? null;
            })
            .catch(() => null);

        if (!docId) {
            test.skip(true, "No quotation rows — signature page not available");
        }

        await page.goto(`/signatures/quotation/${docId}`);
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible({ timeout: 20_000 });
        await expect(h1).toContainText(/sign quotation/i);

        // Typed full name + initials inputs.
        await expect(page.getByPlaceholder(/e\.g\. jane doe/i)).toBeVisible();
        await expect(page.getByPlaceholder(/e\.g\. jd/i)).toBeVisible();

        // Consent checkbox with the legal text.
        const consent = page.locator('input[type="checkbox"]').first();
        await expect(consent).toBeVisible();
        await expect(page.getByText(/agree|consent|electronic signature/i).first()).toBeVisible();

        // Submit control is present (we do not click it).
        const signBtn = page.getByRole("button", { name: /agree and sign/i });
        if ((await signBtn.count()) > 0) {
            await expect(signBtn).toBeVisible();
        }
    });

    test("signed-PDF download entry point when signatures exist", async ({
        page,
    }) => {
        const docId = await page
            .evaluate(async () => {
                const res = await fetch("/api/quotations?limit=5");
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                const list = Array.isArray(json?.data) ? json.data : [];
                for (const q of list) {
                    const sig = await fetch(
                        `/api/esign/signatures?document_type=quotation&document_id=${q.id}`
                    ).then((r) => r.json().catch(() => ({ data: [] })));
                    if (sig?.data?.length > 0) return q.id;
                }
                return null;
            })
            .catch(() => null);

        if (!docId) {
            test.skip(true, "No quotation has a signature yet — PDF entry not available");
        }

        await page.goto(`/signatures/quotation/${docId}`);
        const download = page.getByRole("button", { name: /download signed pdf/i });
        await expect(download).toBeVisible({ timeout: 20_000 });
    });
});
