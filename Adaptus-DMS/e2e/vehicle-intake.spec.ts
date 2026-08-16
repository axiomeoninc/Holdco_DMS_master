import { test, expect, type Locator, type Page } from "@playwright/test";
import {
    authSkipReason,
    gotoAuthed,
    hasAuth,
    login,
} from "./fixtures/auth";

const VIEW_DESKTOP = { width: 1280, height: 800 };
const VIEW_PHONE = { width: 375, height: 812 };

function uniqueVin(): string {
    const stamp = Date.now().toString();
    const vin = `1HG${stamp}`.replace(/[IOQ]/gi, "A");
    return `${vin}000000000000000`.slice(0, 17);
}

async function box(locator: Locator) {
    await expect(locator).toBeVisible({ timeout: 15_000 });
    return locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            width: r.width,
            height: r.height,
        };
    });
}

async function pageOverflow(page: Page) {
    return page.evaluate(() => {
        const doc = document.documentElement;
        return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
        };
    });
}

async function dismissIntakeResume(page: Page) {
    await page.evaluate(() => {
        try {
            localStorage.removeItem("adaptus:vehicle-intake-draft");
        } catch {
            /* ignore */
        }
    });
    const discard = page.getByRole("button", { name: /^discard$/i });
    if ((await discard.count()) > 0 && (await discard.first().isVisible())) {
        await discard.first().click();
    }
}

async function openAddNewCar(page: Page) {
    await gotoAuthed(page, `/inventory/new?cb=${Date.now()}`);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await dismissIntakeResume(page);
    await expect(
        page.getByRole("heading", { name: /add new car/i }).first()
    ).toBeVisible({ timeout: 20_000 });
}

async function vinInput(page: Page) {
    return page.getByPlaceholder("17-character VIN").first();
}

async function decodeButton(page: Page) {
    return page.getByRole("button", { name: /^decode vin$/i }).first();
}

async function fillMakeModel(page: Page, make: string, model: string) {
    const makeField = page.getByPlaceholder(/search make/i);
    await makeField.click();
    await makeField.fill(make);
    const makeHit = page.getByRole("button", { name: new RegExp(`^${make}$`, "i") });
    if ((await makeHit.count()) > 0) {
        await makeHit.first().click();
    } else {
        await makeField.press("Escape");
    }

    const modelField = page.getByPlaceholder(/search model|select make first/i);
    await modelField.click();
    await modelField.fill(model);
    const modelHit = page.getByRole("button", { name: new RegExp(`^${model}$`, "i") });
    if ((await modelHit.count()) > 0) {
        await modelHit.first().click();
    } else {
        await modelField.press("Escape");
    }
}

async function closeVinLookup(page: Page) {
    const lookupHeading = page.getByRole("heading", { name: /vin lookup/i });
    if (!(await lookupHeading.isVisible().catch(() => false))) return;
    await page.keyboard.press("Escape");
    await lookupHeading.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
    if (await lookupHeading.isVisible().catch(() => false)) {
        await page
            .getByRole("button", { name: /close|dismiss/i })
            .first()
            .click({ force: true })
            .catch(() => undefined);
    }
    if (await lookupHeading.isVisible().catch(() => false)) {
        await page
            .locator(".fixed.inset-0.z-50")
            .first()
            .click({ position: { x: 8, y: 8 }, force: true })
            .catch(() => undefined);
    }
    await lookupHeading.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
}

async function maybeDecodeVin(page: Page) {
    const decode = await decodeButton(page);
    await decode.click();
    const lookupHeading = page.getByRole("heading", { name: /vin lookup/i });
    const opened = await lookupHeading
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
    if (!opened) return;

    try {
        const lookup = page.getByRole("button", { name: /^lookup$/i });
        if ((await lookup.count()) > 0) {
            await lookup.first().click();
            await page
                .getByText(/vehicle found|could not|failed|not found|unavailable/i)
                .first()
                .waitFor({ timeout: 4_000 })
                .catch(() => undefined);
        }
    } finally {
        await closeVinLookup(page);
    }
}

async function fillYearMakeModelTrim(page: Page) {
    const yearField = page.getByLabel(/^year$/i);
    if ((await yearField.count()) > 0) {
        const year = String(new Date().getFullYear());
        await yearField
            .first()
            .selectOption(year)
            .catch(async () => {
                await yearField.first().fill(year).catch(() => undefined);
            });
    }

    const makeVal = await page.getByPlaceholder(/search make/i).inputValue();
    const modelVal = await page
        .getByPlaceholder(/search model|select make first/i)
        .inputValue();
    if (!makeVal.trim() || !modelVal.trim()) {
        await fillMakeModel(page, "Honda", "Civic");
    }

    const trim = page.getByLabel(/^trim$/i);
    if ((await trim.count()) > 0) {
        await trim.first().fill("LX");
    }
    await page.keyboard.press("Escape").catch(() => undefined);
}

async function clickNamedCta(page: Page, label: string) {
    const byText = page.locator("button", { hasText: label }).last();
    await expect(byText).toBeVisible({ timeout: 15_000 });
    await byText.click({ force: true });
}

test.describe("Add New Car + dealer add sheets", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name !== "desktop",
            "Viewport geometry is set explicitly; skip the mobile project"
        );
        test.skip(!hasAuth, authSkipReason);
        await login(page);
    });

    test("VIN + Decode geometry and 5-step intake smoke", async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize(VIEW_DESKTOP);
        await openAddNewCar(page);
        await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());

        const vin = await vinInput(page);
        const decode = await decodeButton(page);

        await expect(
            page.getByText(/continue saves a server draft so photo upload works/i)
        ).toBeVisible();

        const desktopVin = await box(vin);
        const desktopDecode = await box(decode);
        const desktopTopDelta = Math.abs(desktopVin.top - desktopDecode.top);
        const desktopShareRow = desktopDecode.left > desktopVin.left + desktopVin.width / 2;

        await page.setViewportSize(VIEW_PHONE);
        await expect(decode).toBeVisible({ timeout: 10_000 });
        const phoneVin = await box(vin);
        const phoneDecode = await box(decode);
        const phoneStacked = phoneDecode.top > phoneVin.bottom - 2;
        const phoneFullWidth = Math.abs(phoneDecode.width - phoneVin.width) <= 16;

        await page.setViewportSize(VIEW_DESKTOP);
        await vin.fill(uniqueVin());
        await expect(vin).toHaveValue(/^[A-HJ-NPR-Z0-9]{17}$/);

        try {
            await maybeDecodeVin(page);
        } catch {
            /* NHTSA/decode outage must not fail the suite */
        }
        await closeVinLookup(page);

        await fillYearMakeModelTrim(page);

        const saveContinue = page.getByRole("button", {
            name: /save draft & continue/i,
        });
        await expect(saveContinue).toBeVisible();
        await expect(saveContinue).toBeEnabled();

        const draftPost = page.waitForResponse(
            (res) => {
                try {
                    const path = new URL(res.url()).pathname;
                    return path === "/api/vehicles" && res.request().method() === "POST";
                } catch {
                    return false;
                }
            },
            { timeout: 25_000 }
        );

        await saveContinue.click();

        const draftRes = await draftPost.catch(() => null);
        if (!draftRes) {
            const blocked = await page
                .getByRole("alert")
                .first()
                .innerText()
                .catch(() => "");
            throw new Error(
                `Draft POST /api/vehicles never fired. UI: ${blocked.slice(0, 180) || "no alert"}`
            );
        }
        expect(
            draftRes.status(),
            `Continue must save a server draft (201), not ${draftRes.status()}`
        ).toBe(201);

        // Specs "Odometer" label is paired with FieldHelp ("Help: Odometer").
        const specsLandmark = page.getByRole("button", { name: /help: odometer/i });
        await expect(specsLandmark).toBeVisible({ timeout: 25_000 });

        const next = page.getByRole("button", { name: /^continue$/i });
        const stepChecks: Array<{ name: string; marker: Locator }> = [
            {
                name: "Pricing",
                marker: page.getByText(/purchase price/i).first(),
            },
            {
                name: "Images",
                marker: page
                    .getByText(/save the vin draft first to unlock photos|photos|upload/i)
                    .first(),
            },
            {
                name: "Review",
                marker: page.getByText(/publish as|save as draft \(coming soon\)|coming soon = draft/i).first(),
            },
        ];

        for (const step of stepChecks) {
            await expect(next).toBeVisible({ timeout: 10_000 });
            await expect(next).toBeEnabled();
            await next.click();
            await expect(step.marker).toBeVisible({ timeout: 20_000 });
        }

        expect(phoneStacked, "Decode should sit below VIN at 375").toBeTruthy();
        expect(phoneFullWidth, "Decode should be full width with VIN at 375").toBeTruthy();
        expect(desktopShareRow, "Decode should sit to the right of VIN at 1280").toBeTruthy();
        expect(
            desktopTopDelta,
            `VIN input and Decode tops should match at 1280 (got Δ${desktopTopDelta.toFixed(1)}px)`
        ).toBeLessThanOrEqual(8);
    });

    test("Lead / Customer / Deal add sheets stack and do not overflow", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const sheets: Array<{
            path: string;
            listHeading: RegExp;
            cta: string;
            add: RegExp;
            openLoc: () => Locator;
            kind: "modal" | "page";
            left: () => Locator;
            right: () => Locator;
            columnsOnDesktop: boolean;
        }> = [
            {
                path: "/leads",
                listHeading: /leads/i,
                cta: "Add Lead",
                add: /add lead/i,
                openLoc: () =>
                    page
                        .locator("#lead-form-modal")
                        .or(page.getByRole("heading", { name: /add new lead/i })),
                kind: "modal",
                left: () => page.locator("select[name='source']"),
                right: () => page.locator("select[name='status']").last(),
                columnsOnDesktop: true,
            },
            {
                path: "/customers",
                listHeading: /customers/i,
                cta: "Add Customer",
                add: /add customer/i,
                openLoc: () =>
                    page
                        .locator("#customer-form-modal")
                        .or(page.getByRole("heading", { name: /add new customer/i })),
                kind: "modal",
                left: () => page.getByPlaceholder("john@company.com"),
                right: () => page.getByPlaceholder("+1 234 567 8900"),
                columnsOnDesktop: true,
            },
            {
                path: "/deals",
                listHeading: /deals/i,
                cta: "New Deal",
                add: /new deal/i,
                openLoc: () => page.getByRole("heading", { name: /^new deal$/i }),
                kind: "page",
                left: () => page.locator("main select").nth(0),
                right: () => page.locator("main select").nth(1),
                columnsOnDesktop: false,
            },
        ];

        for (const view of [VIEW_DESKTOP, VIEW_PHONE] as const) {
            await page.setViewportSize(view);
            const phone = view.width < 640;

            for (const sheet of sheets) {
                await gotoAuthed(page, sheet.path);
                await expect(page.locator("h1").first()).toContainText(
                    sheet.listHeading,
                    { timeout: 20_000 }
                );
                if (phone && sheet.path === "/leads") {
                    await page
                        .locator("header.space-y-2")
                        .locator("button")
                        .nth(1)
                        .click({ force: true, timeout: 10_000 });
                } else {
                    await clickNamedCta(page, sheet.cta);
                }

                const opened = sheet.openLoc().first();
                await expect(opened).toBeVisible({ timeout: 20_000 });

                const overflow = await pageOverflow(page);
                expect(
                    overflow.scrollWidth,
                    `${sheet.path} @${view.width} documentElement must not overflow horizontally`
                ).toBeLessThanOrEqual(overflow.clientWidth);

                const a = await box(sheet.left());
                const b = await box(sheet.right());
                if (phone) {
                    expect
                        .soft(
                            b.top,
                            `${sheet.path} fields should stack at ${view.width}`
                        )
                        .toBeGreaterThan(a.bottom - 2);
                } else if (sheet.columnsOnDesktop) {
                    expect
                        .soft(
                            Math.abs(a.top - b.top),
                            `${sheet.path} fields should share a row at ${view.width}`
                        )
                        .toBeLessThanOrEqual(8);
                }

                if (sheet.kind === "modal") {
                    await page.keyboard.press("Escape");
                    await expect(opened).toBeHidden({ timeout: 8_000 });
                }
            }
        }
    });
});
