import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./mobile-ui-tests",
  outputDir: "mobile-test-results",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    channel: process.env.PLAYWRIGHT_CHANNEL === "chrome" ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "small-phone",
      use: {
        ...devices["iPhone SE"],
        viewport: { width: 320, height: 568 },
        browserName: "chromium",
      },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/serve-mobile.mjs",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
