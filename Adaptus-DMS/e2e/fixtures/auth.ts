import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const e2eEmail = process.env.E2E_EMAIL?.trim();
export const e2ePassword = process.env.E2E_PASSWORD?.trim();
export const hasAuth = Boolean(e2eEmail && e2ePassword);

export const authSkipReason =
    "Set E2E_EMAIL and E2E_PASSWORD to run authenticated specs";

/** Login via the public /login form. Requires E2E_EMAIL + E2E_PASSWORD. */
export async function login(page: Page) {
    if (!e2eEmail || !e2ePassword) {
        throw new Error(authSkipReason);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto("/login");
        const email = page.getByLabel(/email/i);
        await expect(email).toBeVisible({ timeout: 20_000 });
        await email.fill(e2eEmail);
        const password = page.locator("#password-input");
        await expect(password).toBeVisible();
        await password.fill(e2ePassword);
        await expect(password).toHaveValue(e2ePassword);
        await page.getByRole("button", { name: /^sign in$/i }).click();
        await page.waitForURL((url) => !url.pathname.includes("/login"), {
            timeout: 30_000,
        });
        const deadline = Date.now() + 12_000;
        let meOk = false;
        while (Date.now() < deadline) {
            if ((await page.request.get("/api/me")).ok()) {
                meOk = true;
                break;
            }
            await page.waitForTimeout(400);
        }
        if (meOk) {
            await bindHomeRooftop(page);
            return;
        }
    }
    throw new Error("Signed in, but /api/me did not become ready");
}

/** Navigate while already authenticated. Avoids racing /dashboard after login landing. */
export async function gotoAuthed(page: Page, path: string) {
    const current = new URL(page.url()).pathname.replace(/\/$/, "") || "/";
    const target = path.replace(/\/$/, "") || "/";
    const alreadyThere =
        current === target ||
        (target === "/dashboard" && (current === "/" || current === "/dashboard"));
    if (!alreadyThere) {
        try {
            await page.goto(path, { waitUntil: "domcontentloaded" });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes("interrupted")) throw err;
            await page.waitForURL((url) => !url.pathname.includes("/login"), {
                timeout: 20_000,
            });
        }
    }
    if (new URL(page.url()).pathname.includes("/login")) {
        await login(page);
        const after = new URL(page.url()).pathname.replace(/\/$/, "") || "/";
        if (after !== target) {
            await page.goto(path, { waitUntil: "domcontentloaded" });
        }
    }
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/**
 * Platform QA users have a home `dealership_id` (Nova). Without the Act-as
 * cookie, CRM lists fail-closed to the empty sentinel. Bind the profile
 * rooftop so inventory/deals/invoices journeys actually run.
 */
async function bindHomeRooftop(page: Page) {
    const rooftop = await page
        .evaluate(async () => {
            const res = await fetch("/api/me", { credentials: "include" });
            if (!res.ok) return null;
            const json = (await res.json().catch(() => null)) as {
                data?: { dealership_id?: string | null };
                dealership_id?: string | null;
            } | null;
            const id = json?.data?.dealership_id ?? json?.dealership_id;
            return typeof id === "string" && id.trim() ? id.trim() : null;
        })
        .catch(() => null);
    if (!rooftop) return;
    await page.context().addCookies([
        {
            name: "dealership_id",
            value: rooftop,
            url: page.url(),
        },
    ]);
}

/** axe WCAG 2 A/AA — color-contrast left to brand/visual QA. */
export async function axeScan(page: Page, routeName: string) {
    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast"])
        .analyze();
    const serious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
        serious,
        `${routeName} axe serious/critical:\n${serious
            .map((v) => `${v.id}: ${v.help}`)
            .join("\n")}`
    ).toEqual([]);
}

/** Mask volatile chrome for critical-route screenshots. */
export function volatileMask(page: Page) {
    return [
        page.locator("time"),
        page.locator("[data-testid='avatar']"),
        page.locator("img[alt*='avatar' i]"),
    ];
}
