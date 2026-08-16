import { defineConfig, devices } from "@playwright/test";

/**
 * FlashFender Playwright harness — journeys + axe + thin critical screenshots.
 * Desktop 1280 + mobile 390. Auth via E2E_EMAIL / E2E_PASSWORD when set.
 */
const baseURL =
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    "https://app.flashfender.com";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : 2,
    reporter: [["list"], ["html", { open: "never" }]],
    timeout: 60_000,
    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.04,
            animations: "disabled",
        },
    },
    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "off",
    },
    projects: [
        {
            name: "desktop",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1280, height: 800 },
            },
        },
        {
            name: "mobile",
            use: {
                ...devices["iPhone 12"],
                viewport: { width: 390, height: 844 },
            },
        },
    ],
});
