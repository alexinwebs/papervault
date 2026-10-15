import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 150_000,
  expect: { timeout: 15_000 },
  retries: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  // These workflows share and mutate one seeded catalogue/database. Keep CI
  // serial so browser flows do not interfere with each other's test state.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000",
    // CI must exercise its fresh build, not an unrelated process on port 3000.
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
