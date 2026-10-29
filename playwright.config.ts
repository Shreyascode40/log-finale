import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  reporter: "list",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 1400 } },
      testIgnore: /paper-mobile\.spec\.ts/,
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /paper-mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev apps/web -p ${port}`,
    url: `http://127.0.0.1:${port}/demo/paper`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 2_000 },
    timeout: 120_000,
  },
});
